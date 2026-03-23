use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::errors::SeekerIOUError;
use crate::events::Deposited;
use crate::state::Vault;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref(), token_mint.key().as_ref()],
        bump = vault.bump,
        has_one = owner,
        has_one = token_mint,
        constraint = vault.is_active @ SeekerIOUError::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = owner,
    )]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        address = vault.token_account,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, SeekerIOUError::InvalidDepositAmount);

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.owner_token_account.to_account_info(),
        mint: ctx.accounts.token_mint.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token_interface::transfer_checked(cpi_ctx, amount, ctx.accounts.token_mint.decimals)?;

    let vault = &mut ctx.accounts.vault;
    vault.deposited_amount = vault
        .deposited_amount
        .checked_add(amount)
        .ok_or(SeekerIOUError::ArithmeticOverflow)?;

    emit!(Deposited {
        vault: vault.key(),
        amount,
        new_total: vault.deposited_amount,
    });

    Ok(())
}
