use anchor_lang::prelude::*;
use anchor_lang::solana_program::ed25519_program;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::sysvar::instructions as instructions_sysvar;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::errors::SeekerIOUError;
use crate::events::{IOUFailed, IOUSettled};
use crate::iou::IOUMessage;
use crate::state::{ReputationAccount, SettlementRecord, Vault};

#[derive(Accounts)]
#[instruction(iou_message: Vec<u8>, signature: [u8; 64], nonce: u64)]
pub struct SettleIOU<'info> {
    #[account(mut)]
    pub settler: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref(), token_mint.key().as_ref()],
        bump = vault.bump,
        constraint = vault.is_active @ SeekerIOUError::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        address = vault.token_account,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Recipient wallet, validated against IOU message
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = settler,
        associated_token::mint = token_mint,
        associated_token::authority = recipient,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = settler,
        space = 8 + SettlementRecord::INIT_SPACE,
        seeds = [b"settlement", vault.key().as_ref(), &nonce.to_le_bytes()],
        bump,
    )]
    pub settlement_record: Account<'info, SettlementRecord>,

    #[account(
        mut,
        seeds = [b"reputation", vault.sgt_mint.as_ref()],
        bump = reputation.bump,
    )]
    pub reputation: Account<'info, ReputationAccount>,

    /// CHECK: Instructions sysvar for Ed25519 verification
    #[account(address = instructions_sysvar::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(
    ctx: Context<SettleIOU>,
    iou_message: Vec<u8>,
    signature: [u8; 64],
    nonce: u64,
) -> Result<()> {
    // Deserialize IOU message
    let iou: IOUMessage = borsh::BorshDeserialize::try_from_slice(&iou_message)
        .map_err(|_| error!(SeekerIOUError::InvalidIOUMessage))?;

    // Validate IOU version
    require!(iou.version == 1, SeekerIOUError::InvalidIOUVersion);

    // Validate IOU fields match accounts
    require!(
        iou.vault == ctx.accounts.vault.key(),
        SeekerIOUError::IOUVaultMismatch
    );
    require!(
        iou.sender == ctx.accounts.vault.owner,
        SeekerIOUError::IOUSenderMismatch
    );
    require!(
        iou.recipient == ctx.accounts.recipient.key(),
        SeekerIOUError::IOURecipientMismatch
    );
    require!(
        iou.token_mint == ctx.accounts.token_mint.key(),
        SeekerIOUError::IOUTokenMintMismatch
    );
    require!(
        iou.sgt_mint == ctx.accounts.vault.sgt_mint,
        SeekerIOUError::IOUSgtMintMismatch
    );
    require!(iou.nonce == nonce, SeekerIOUError::NonceMismatch);
    require!(iou.amount > 0, SeekerIOUError::InvalidIOUAmount);

    // Validate nonce is strictly greater than vault current nonce
    require!(
        nonce > ctx.accounts.vault.current_nonce,
        SeekerIOUError::InvalidNonce
    );

    // Check expiry
    if iou.expiry > 0 {
        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp <= iou.expiry,
            SeekerIOUError::IOUExpired
        );
    }

    // Verify Ed25519 signature via instructions sysvar
    verify_ed25519_signature(
        &ctx.accounts.instructions_sysvar,
        &iou.sender.to_bytes(),
        &iou_message,
        &signature,
    )?;

    let vault = &mut ctx.accounts.vault;
    let available_balance = vault
        .deposited_amount
        .checked_sub(vault.spent_amount)
        .ok_or(SeekerIOUError::ArithmeticOverflow)?;

    let clock = Clock::get()?;

    if available_balance >= iou.amount {
        // Transfer tokens from vault to recipient
        let owner_key = vault.owner;
        let token_mint_key = ctx.accounts.token_mint.key();
        let seeds = &[
            b"vault",
            owner_key.as_ref(),
            token_mint_key.as_ref(),
            &[vault.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = TransferChecked {
            from: ctx.accounts.vault_token_account.to_account_info(),
            mint: ctx.accounts.token_mint.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: vault.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        token_interface::transfer_checked(cpi_ctx, iou.amount, ctx.accounts.token_mint.decimals)?;

        vault.spent_amount = vault
            .spent_amount
            .checked_add(iou.amount)
            .ok_or(SeekerIOUError::ArithmeticOverflow)?;
        vault.current_nonce = nonce;

        // Create settlement record
        let record = &mut ctx.accounts.settlement_record;
        record.vault = vault.key();
        record.recipient = ctx.accounts.recipient.key();
        record.amount = iou.amount;
        record.nonce = nonce;
        record.settled_at = clock.unix_timestamp;
        record.settled_by = ctx.accounts.settler.key();
        record.success = true;
        record.bump = ctx.bumps.settlement_record;

        // Update reputation
        let reputation = &mut ctx.accounts.reputation;
        reputation.total_issued = reputation
            .total_issued
            .checked_add(1)
            .ok_or(SeekerIOUError::ArithmeticOverflow)?;
        reputation.total_settled = reputation
            .total_settled
            .checked_add(1)
            .ok_or(SeekerIOUError::ArithmeticOverflow)?;
        reputation.total_volume = reputation
            .total_volume
            .checked_add(iou.amount)
            .ok_or(SeekerIOUError::ArithmeticOverflow)?;

        emit!(IOUSettled {
            vault: vault.key(),
            recipient: ctx.accounts.recipient.key(),
            amount: iou.amount,
            nonce,
            settler: ctx.accounts.settler.key(),
        });
    } else {
        // Insufficient funds - still record and update reputation
        vault.current_nonce = nonce;

        let record = &mut ctx.accounts.settlement_record;
        record.vault = vault.key();
        record.recipient = ctx.accounts.recipient.key();
        record.amount = iou.amount;
        record.nonce = nonce;
        record.settled_at = clock.unix_timestamp;
        record.settled_by = ctx.accounts.settler.key();
        record.success = false;
        record.bump = ctx.bumps.settlement_record;

        let reputation = &mut ctx.accounts.reputation;
        reputation.total_issued = reputation
            .total_issued
            .checked_add(1)
            .ok_or(SeekerIOUError::ArithmeticOverflow)?;
        reputation.total_failed = reputation
            .total_failed
            .checked_add(1)
            .ok_or(SeekerIOUError::ArithmeticOverflow)?;
        reputation.last_failure_at = clock.unix_timestamp;

        emit!(IOUFailed {
            vault: vault.key(),
            recipient: ctx.accounts.recipient.key(),
            amount: iou.amount,
            nonce,
            settler: ctx.accounts.settler.key(),
            reason: "Insufficient vault balance".to_string(),
        });
    }

    Ok(())
}

fn verify_ed25519_signature(
    instructions_sysvar: &UncheckedAccount,
    pubkey: &[u8; 32],
    message: &[u8],
    signature: &[u8; 64],
) -> Result<()> {
    let ix: Instruction =
        instructions_sysvar::load_instruction_at_checked(0, &instructions_sysvar.to_account_info())
            .map_err(|_| error!(SeekerIOUError::MissingEd25519Instruction))?;

    // Verify it's an Ed25519 program instruction
    require!(
        ix.program_id == ed25519_program::ID,
        SeekerIOUError::MissingEd25519Instruction
    );

    // Ed25519 instruction data format:
    // - num_signatures (1 byte, u8) = 1
    // - padding (1 byte) = 0
    // For each signature:
    //   - signature_offset (2 bytes, u16)
    //   - signature_instruction_index (2 bytes, u16)
    //   - public_key_offset (2 bytes, u16)
    //   - public_key_instruction_index (2 bytes, u16)
    //   - message_data_offset (2 bytes, u16)
    //   - message_data_size (2 bytes, u16)
    //   - message_instruction_index (2 bytes, u16)
    // Then the actual data (pubkey, signature, message)

    let ix_data = &ix.data;
    require!(
        ix_data.len() >= 2,
        SeekerIOUError::InvalidEd25519InstructionData
    );

    let num_signatures = ix_data[0];
    require!(
        num_signatures == 1,
        SeekerIOUError::InvalidEd25519InstructionData
    );

    // Parse offsets
    require!(
        ix_data.len() >= 16,
        SeekerIOUError::InvalidEd25519InstructionData
    );

    let signature_offset = u16::from_le_bytes([ix_data[2], ix_data[3]]) as usize;
    let public_key_offset = u16::from_le_bytes([ix_data[6], ix_data[7]]) as usize;
    let message_data_offset = u16::from_le_bytes([ix_data[10], ix_data[11]]) as usize;
    let message_data_size = u16::from_le_bytes([ix_data[12], ix_data[13]]) as usize;

    // Verify the public key matches
    require!(
        ix_data.len() >= public_key_offset + 32,
        SeekerIOUError::InvalidEd25519InstructionData
    );
    let ix_pubkey = &ix_data[public_key_offset..public_key_offset + 32];
    require!(
        ix_pubkey == pubkey,
        SeekerIOUError::InvalidSignature
    );

    // Verify the signature matches
    require!(
        ix_data.len() >= signature_offset + 64,
        SeekerIOUError::InvalidEd25519InstructionData
    );
    let ix_signature = &ix_data[signature_offset..signature_offset + 64];
    require!(
        ix_signature == signature,
        SeekerIOUError::InvalidSignature
    );

    // Verify the message matches
    require!(
        message_data_size == message.len(),
        SeekerIOUError::InvalidEd25519InstructionData
    );
    require!(
        ix_data.len() >= message_data_offset + message_data_size,
        SeekerIOUError::InvalidEd25519InstructionData
    );
    let ix_message = &ix_data[message_data_offset..message_data_offset + message_data_size];
    require!(
        ix_message == message,
        SeekerIOUError::InvalidSignature
    );

    Ok(())
}
