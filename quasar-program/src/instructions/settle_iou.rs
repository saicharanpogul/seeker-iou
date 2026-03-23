use quasar_lang::prelude::*;
use quasar_lang::sysvars::Sysvar as SysvarTrait;
use quasar_spl::{AssociatedTokenProgram, InterfaceAccount, Mint, Token, TokenCpi, TokenInterface};

use crate::errors::SeekerIOUError;
use crate::events::{IOUFailed, IOUSettled};
use crate::iou::IOUMessage;
use crate::state::{ReputationAccount, SettlementRecord, Vault};

const ED25519_PROGRAM_ID: Address = address!("Ed25519SigVerify111111111111111111111111111");
const SYSVAR_INSTRUCTIONS_ID: Address = address!("Sysvar1nstructions1111111111111111111111111");

#[derive(Accounts)]
pub struct SettleIOU<'info> {
    pub settler: &'info mut Signer,

    #[account(
        mut,
        seeds = [b"vault", owner, token_mint],
        bump = vault.bump,
        has_one = owner,
        has_one = token_mint,
        constraint = vault.is_active.get() @ SeekerIOUError::VaultNotActive,
    )]
    pub vault: &'info mut Account<Vault>,

    pub owner: &'info UncheckedAccount,

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

    #[account(init, payer = settler)]
    pub settlement_record: &'info mut Account<SettlementRecord>,

    #[account(
        mut,
        seeds = [b"reputation", sgt_mint],
        bump = reputation.bump,
    )]
    pub reputation: &'info mut Account<ReputationAccount>,

    pub sgt_mint: &'info InterfaceAccount<Mint>,

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
            iou.sender_address() == self.owner.address(),
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
            iou.sgt_mint_address() == self.sgt_mint.address(),
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
            require!(clock.unix_timestamp.get() <= expiry, SeekerIOUError::IOUExpired);
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
                .transfer(
                    self.vault_token_account,
                    self.recipient_token_account,
                    self.vault,
                    amount,
                )
                .invoke_signed(&seeds)?;

            self.vault.spent_amount = self
                .vault
                .spent_amount
                .get()
                .checked_add(amount)
                .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?
                .into();
            self.vault.current_nonce = nonce.into();

            self.settlement_record.set_inner(
                *self.vault.address(),       // vault
                *self.recipient.address(),   // recipient
                amount,                      // amount
                nonce,                       // nonce
                clock.unix_timestamp.get(),  // settled_at
                *self.settler.address(),     // settled_by
                true,                        // success
                0u64,                        // slash_amount
                0u8,                         // bump (not a PDA)
            );

            self.reputation.total_issued = self
                .reputation
                .total_issued
                .get()
                .checked_add(1)
                .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?
                .into();
            self.reputation.total_settled = self
                .reputation
                .total_settled
                .get()
                .checked_add(1)
                .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?
                .into();
            self.reputation.total_volume = self
                .reputation
                .total_volume
                .get()
                .checked_add(amount)
                .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?
                .into();

            emit!(IOUSettled {
                vault: *self.vault.address(),
                recipient: *self.recipient.address(),
                amount,
                nonce,
                settler: *self.settler.address(),
            });
        } else {
            // === FAILURE -- bond slashing ===
            let slash_amount = bond.min(amount);

            if slash_amount > 0 {
                let seeds = bumps.vault_seeds();

                self.token_program
                    .transfer(
                        self.vault_token_account,
                        self.recipient_token_account,
                        self.vault,
                        slash_amount,
                    )
                    .invoke_signed(&seeds)?;

                self.vault.spent_amount = self
                    .vault
                    .spent_amount
                    .get()
                    .checked_add(slash_amount)
                    .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?
                    .into();
                self.vault.total_slashed = self
                    .vault
                    .total_slashed
                    .get()
                    .checked_add(slash_amount)
                    .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?
                    .into();
            }

            self.vault.current_nonce = nonce.into();

            self.settlement_record.set_inner(
                *self.vault.address(),       // vault
                *self.recipient.address(),   // recipient
                amount,                      // amount
                nonce,                       // nonce
                clock.unix_timestamp.get(),  // settled_at
                *self.settler.address(),     // settled_by
                false,                       // success
                slash_amount,                // slash_amount
                0u8,                         // bump (not a PDA)
            );

            self.reputation.total_issued = self
                .reputation
                .total_issued
                .get()
                .checked_add(1)
                .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?
                .into();
            self.reputation.total_failed = self
                .reputation
                .total_failed
                .get()
                .checked_add(1)
                .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?
                .into();
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
    // Read the raw sysvar data via the account view
    let view = instructions_sysvar.to_account_view();
    let borrowed = unsafe { view.borrow_unchecked() };

    // Sysvar instructions format:
    // Last 2 bytes = current instruction index (u16 LE)
    // First 2 bytes = number of instructions (u16 LE)
    // Then for each instruction: offset (u16 LE)
    // Each instruction at offset: num_accounts(u16), [account_meta...], program_id(32), data_len(u16), data(...)

    if borrowed.len() < 4 {
        return Err(ProgramError::from(SeekerIOUError::MissingEd25519Instruction));
    }

    let num_instructions = u16::from_le_bytes([borrowed[0], borrowed[1]]) as usize;
    if num_instructions == 0 {
        return Err(ProgramError::from(SeekerIOUError::MissingEd25519Instruction));
    }

    // Offset of instruction 0
    let offset_pos = 2;
    if borrowed.len() < offset_pos + 2 {
        return Err(ProgramError::from(SeekerIOUError::MissingEd25519Instruction));
    }
    let ix_offset = u16::from_le_bytes([borrowed[offset_pos], borrowed[offset_pos + 1]]) as usize;

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
