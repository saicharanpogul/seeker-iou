use quasar_lang::prelude::*;
use quasar_spl::{AssociatedTokenProgram, InterfaceAccount, Mint, Token, TokenCpi, TokenInterface};

use crate::errors::SeekerIOUError;
use crate::events::{IOUFailed, IOUSettled};
use crate::iou::IOUMessage;
use crate::state::{ReputationAccount, SettlementRecord, Vault};

const ED25519_PROGRAM_ID: Address = address!("Ed25519SigVerify111111111111111111111111111");
const SYSVAR_INSTRUCTIONS_ID: Address = address!("Sysvar1nstructions1111111111111111111111111");

#[derive(Accounts)]
#[instruction(iou_message: &[u8], signature: &[u8], nonce: u64)]
pub struct SettleIOU<'info> {
    pub settler: &'info mut Signer,

    #[account(
        mut,
        seeds = [b"vault", vault.owner, token_mint],
        bump = vault.bump,
        constraint = vault.is_active.get() @ SeekerIOUError::VaultNotActive,
    )]
    pub vault: &'info mut Account<Vault>,

    pub token_mint: &'info InterfaceAccount<Mint>,

    #[account(mut, address = vault.token_account)]
    pub vault_token_account: &'info mut InterfaceAccount<Token>,

    #[account(mut)]
    pub recipient: &'info mut UncheckedAccount,

    #[account(
        init_if_needed,
        payer = settler,
        associated_token::mint = token_mint,
        associated_token::authority = recipient,
    )]
    pub recipient_token_account: &'info mut InterfaceAccount<Token>,

    #[account(
        init,
        payer = settler,
        seeds = [b"settlement", vault, &nonce.to_le_bytes()],
        bump,
    )]
    pub settlement_record: &'info mut Account<SettlementRecord>,

    #[account(
        mut,
        seeds = [b"reputation", vault.sgt_mint],
        bump = reputation.bump,
    )]
    pub reputation: &'info mut Account<ReputationAccount>,

    #[account(address = SYSVAR_INSTRUCTIONS_ID)]
    pub instructions_sysvar: &'info UncheckedAccount,

    pub system_program: &'info Program<System>,
    pub token_program: &'info Interface<TokenInterface>,
    pub ata_program: &'info Program<AssociatedTokenProgram>,
}

impl<'info> SettleIOU<'info> {
    #[inline(always)]
    pub fn settle(
        &mut self,
        iou_message: &[u8],
        signature: &[u8],
        nonce: u64,
        bumps: &SettleIOUBumps,
    ) -> Result<(), ProgramError> {
        // Parse IOU message
        let iou = IOUMessage::from_bytes(iou_message)
            .ok_or(ProgramError::from(SeekerIOUError::InvalidIOUMessage))?;

        require!(iou.version == 1, SeekerIOUError::InvalidIOUVersion);
        require!(
            iou.vault_address() == self.vault.address(),
            SeekerIOUError::IOUVaultMismatch
        );
        require!(
            *iou.sender_address() == self.vault.owner,
            SeekerIOUError::IOUSenderMismatch
        );
        require!(
            iou.recipient_address() == self.recipient.address(),
            SeekerIOUError::IOURecipientMismatch
        );
        require!(
            iou.token_mint_address() == self.token_mint.address(),
            SeekerIOUError::IOUTokenMintMismatch
        );
        require!(
            *iou.sgt_mint_address() == self.vault.sgt_mint,
            SeekerIOUError::IOUSgtMintMismatch
        );
        require!(iou.nonce_u64() == nonce, SeekerIOUError::NonceMismatch);

        let amount = iou.amount_u64();
        require!(amount > 0, SeekerIOUError::InvalidIOUAmount);
        require!(
            nonce > self.vault.current_nonce.get(),
            SeekerIOUError::InvalidNonce
        );

        let expiry = iou.expiry_i64();
        if expiry > 0 {
            let clock = Clock::get()?;
            require!(clock.unix_timestamp <= expiry, SeekerIOUError::IOUExpired);
        }

        // Verify Ed25519 signature
        require!(signature.len() == 64, SeekerIOUError::InvalidSignature);
        verify_ed25519_signature(
            self.instructions_sysvar,
            &iou.sender,
            iou_message,
            signature,
        )?;

        // Calculate available balance (accounting for reserve)
        let remaining = self
            .vault
            .deposited_amount
            .get()
            .saturating_sub(self.vault.spent_amount.get());
        let bond = (remaining as u128 * self.vault.reserve_ratio_bps.get() as u128 / 10000) as u64;
        let available = remaining.saturating_sub(bond);

        let clock = Clock::get()?;

        if available >= amount {
            // === SUCCESS ===
            let seeds = bumps.vault_seeds();

            self.token_program
                .transfer_checked(
                    self.vault_token_account,
                    self.token_mint,
                    self.recipient_token_account,
                    self.vault,
                    amount,
                    self.token_mint.decimals(),
                )
                .invoke_signed(&seeds)?;

            self.vault.spent_amount = self
                .vault
                .spent_amount
                .get()
                .checked_add(amount)
                .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?;
            self.vault.current_nonce = nonce;

            self.settlement_record.vault = *self.vault.address();
            self.settlement_record.recipient = *self.recipient.address();
            self.settlement_record.amount = amount;
            self.settlement_record.nonce = nonce;
            self.settlement_record.settled_at = clock.unix_timestamp;
            self.settlement_record.settled_by = *self.settler.address();
            self.settlement_record.success = true;
            self.settlement_record.slash_amount = 0;
            self.settlement_record.bump = bumps.settlement_record;

            self.reputation.total_issued = self
                .reputation
                .total_issued
                .get()
                .checked_add(1)
                .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?;
            self.reputation.total_settled = self
                .reputation
                .total_settled
                .get()
                .checked_add(1)
                .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?;
            self.reputation.total_volume = self
                .reputation
                .total_volume
                .get()
                .checked_add(amount)
                .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?;

            emit!(IOUSettled {
                vault: *self.vault.address(),
                recipient: *self.recipient.address(),
                amount,
                nonce,
                settler: *self.settler.address(),
            });
        } else {
            // === FAILURE — bond slashing ===
            let slash_amount = bond.min(amount);

            if slash_amount > 0 {
                let seeds = bumps.vault_seeds();

                self.token_program
                    .transfer_checked(
                        self.vault_token_account,
                        self.token_mint,
                        self.recipient_token_account,
                        self.vault,
                        slash_amount,
                        self.token_mint.decimals(),
                    )
                    .invoke_signed(&seeds)?;

                self.vault.spent_amount = self
                    .vault
                    .spent_amount
                    .get()
                    .checked_add(slash_amount)
                    .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?;
                self.vault.total_slashed = self
                    .vault
                    .total_slashed
                    .get()
                    .checked_add(slash_amount)
                    .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?;
            }

            self.vault.current_nonce = nonce;

            self.settlement_record.vault = *self.vault.address();
            self.settlement_record.recipient = *self.recipient.address();
            self.settlement_record.amount = amount;
            self.settlement_record.nonce = nonce;
            self.settlement_record.settled_at = clock.unix_timestamp;
            self.settlement_record.settled_by = *self.settler.address();
            self.settlement_record.success = false;
            self.settlement_record.slash_amount = slash_amount;
            self.settlement_record.bump = bumps.settlement_record;

            self.reputation.total_issued = self
                .reputation
                .total_issued
                .get()
                .checked_add(1)
                .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?;
            self.reputation.total_failed = self
                .reputation
                .total_failed
                .get()
                .checked_add(1)
                .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?;
            self.reputation.last_failure_at = clock.unix_timestamp;

            emit!(IOUFailed {
                vault: *self.vault.address(),
                recipient: *self.recipient.address(),
                amount,
                nonce,
                settler: *self.settler.address(),
                slash_amount,
            });
        }

        Ok(())
    }
}

fn verify_ed25519_signature(
    instructions_sysvar: &UncheckedAccount,
    pubkey: &[u8; 32],
    message: &[u8],
    signature: &[u8],
) -> Result<(), ProgramError> {
    // Load instruction at index 0 from sysvar
    let ix_data = instructions_sysvar.data();

    // We need to read the instructions sysvar data directly
    // The sysvar contains serialized instruction data
    // For now, use Solana's load_instruction_at_checked equivalent
    // The Ed25519 instruction should be at index 0

    // Simplified: read the raw instruction data from the sysvar
    // Ed25519 instruction data format:
    // [num_sigs(1), padding(1), sig_offset(2), sig_ix(2), pk_offset(2), pk_ix(2), msg_offset(2), msg_size(2), msg_ix(2)]
    // Then: pubkey(32), signature(64), message(N)

    // In Quasar no_std, we use the instructions sysvar raw data
    // The instruction at index 0 is loaded via solana_program::sysvar::instructions
    // Since we're no_std, we parse the sysvar manually

    let ix_account_info = instructions_sysvar.as_account_info();

    // Use the sysvar data to find instruction at index 0
    let borrowed = ix_account_info.try_borrow_data()
        .map_err(|_| ProgramError::from(SeekerIOUError::MissingEd25519Instruction))?;

    // Sysvar instructions format:
    // Last 2 bytes = current instruction index (u16 LE)
    // First 2 bytes = number of instructions (u16 LE)
    // Then for each instruction: offset (u16 LE)
    // Each instruction: program_id(32), num_accounts(u16), [account_meta...], data_len(u16), data(...)

    if borrowed.len() < 4 {
        return Err(ProgramError::from(SeekerIOUError::MissingEd25519Instruction));
    }

    let num_instructions = u16::from_le_bytes([borrowed[0], borrowed[1]]) as usize;
    if num_instructions == 0 {
        return Err(ProgramError::from(SeekerIOUError::MissingEd25519Instruction));
    }

    // Offset of instruction 0
    let offset_pos = 2 + 0 * 2;
    if borrowed.len() < offset_pos + 2 {
        return Err(ProgramError::from(SeekerIOUError::MissingEd25519Instruction));
    }
    let ix_offset = u16::from_le_bytes([borrowed[offset_pos], borrowed[offset_pos + 1]]) as usize;

    // At ix_offset: program_id_index(?) -- actually the format for instructions sysvar is different
    // Let me use the standard pattern: num_accounts(u16), then account_metas, then program_id, then data

    // Actually the serialized format in the instructions sysvar is:
    // For each instruction starting at offset:
    //   program_id_index: not used here, raw instructions:
    //   num_accounts: u16
    //   for each account: pubkey(32) + is_signer(1) + is_writable(1) = 34 bytes
    //   program_id: 32 bytes
    //   data_len: u16
    //   data: [u8; data_len]

    let mut pos = ix_offset;
    if borrowed.len() < pos + 2 {
        return Err(ProgramError::from(SeekerIOUError::MissingEd25519Instruction));
    }

    let num_accounts = u16::from_le_bytes([borrowed[pos], borrowed[pos + 1]]) as usize;
    pos += 2;

    // Skip account metas: each is 34 bytes (pubkey 32 + is_signer 1 + is_writable 1)
    pos += num_accounts * 34;

    // Program ID (32 bytes)
    if borrowed.len() < pos + 32 {
        return Err(ProgramError::from(SeekerIOUError::MissingEd25519Instruction));
    }
    let program_id = &borrowed[pos..pos + 32];
    pos += 32;

    // Verify it's the Ed25519 program
    if program_id != ED25519_PROGRAM_ID.as_ref() {
        return Err(ProgramError::from(SeekerIOUError::MissingEd25519Instruction));
    }

    // Data length (u16)
    if borrowed.len() < pos + 2 {
        return Err(ProgramError::from(SeekerIOUError::InvalidEd25519InstructionData));
    }
    let data_len = u16::from_le_bytes([borrowed[pos], borrowed[pos + 1]]) as usize;
    pos += 2;

    if borrowed.len() < pos + data_len || data_len < 16 {
        return Err(ProgramError::from(SeekerIOUError::InvalidEd25519InstructionData));
    }

    let ed_data = &borrowed[pos..pos + data_len];

    // Parse Ed25519 instruction data
    let num_sigs = ed_data[0];
    if num_sigs != 1 {
        return Err(ProgramError::from(SeekerIOUError::InvalidEd25519InstructionData));
    }

    let sig_offset = u16::from_le_bytes([ed_data[2], ed_data[3]]) as usize;
    let sig_ix_index = u16::from_le_bytes([ed_data[4], ed_data[5]]);
    let pk_offset = u16::from_le_bytes([ed_data[6], ed_data[7]]) as usize;
    let pk_ix_index = u16::from_le_bytes([ed_data[8], ed_data[9]]);
    let msg_offset = u16::from_le_bytes([ed_data[10], ed_data[11]]) as usize;
    let msg_size = u16::from_le_bytes([ed_data[12], ed_data[13]]) as usize;
    let msg_ix_index = u16::from_le_bytes([ed_data[14], ed_data[15]]);

    // All instruction indices must be 0xFFFF (inline)
    if sig_ix_index != u16::MAX || pk_ix_index != u16::MAX || msg_ix_index != u16::MAX {
        return Err(ProgramError::from(SeekerIOUError::InvalidEd25519InstructionData));
    }

    // Verify pubkey
    if ed_data.len() < pk_offset + 32 {
        return Err(ProgramError::from(SeekerIOUError::InvalidEd25519InstructionData));
    }
    if &ed_data[pk_offset..pk_offset + 32] != pubkey {
        return Err(ProgramError::from(SeekerIOUError::InvalidSignature));
    }

    // Verify signature
    if ed_data.len() < sig_offset + 64 {
        return Err(ProgramError::from(SeekerIOUError::InvalidEd25519InstructionData));
    }
    if &ed_data[sig_offset..sig_offset + 64] != signature {
        return Err(ProgramError::from(SeekerIOUError::InvalidSignature));
    }

    // Verify message
    if msg_size != message.len() {
        return Err(ProgramError::from(SeekerIOUError::InvalidEd25519InstructionData));
    }
    if ed_data.len() < msg_offset + msg_size {
        return Err(ProgramError::from(SeekerIOUError::InvalidEd25519InstructionData));
    }
    if &ed_data[msg_offset..msg_offset + msg_size] != message {
        return Err(ProgramError::from(SeekerIOUError::InvalidSignature));
    }

    Ok(())
}
