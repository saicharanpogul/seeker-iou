use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::errors::SeekerIOUError;
use crate::events::VaultWithdrawn;
use crate::state::Vault;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref(), token_mint.key().as_ref()],
        bump = vault.bump,
        has_one = owner,
        has_one = token_mint,
        constraint = !vault.is_active @ SeekerIOUError::VaultStillActive,
    )]
    pub vault: Account<'info, Vault>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        address = vault.token_account,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = owner,
    )]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<Withdraw>) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let clock = Clock::get()?;

    // Check cooldown has elapsed
    let cooldown_end = vault
        .deactivated_at
        .checked_add(vault.cooldown_seconds as i64)
        .ok_or(SeekerIOUError::ArithmeticOverflow)?;
    require!(
        clock.unix_timestamp >= cooldown_end,
        SeekerIOUError::CooldownNotElapsed
    );

    // Calculate remaining balance
    let remaining = vault
        .deposited_amount
        .checked_sub(vault.spent_amount)
        .ok_or(SeekerIOUError::ArithmeticOverflow)?;
    require!(remaining > 0, SeekerIOUError::NoBalanceToWithdraw);

    // Transfer remaining tokens back to owner
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
        to: ctx.accounts.owner_token_account.to_account_info(),
        authority: ctx.accounts.vault.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    token_interface::transfer_checked(cpi_ctx, remaining, ctx.accounts.token_mint.decimals)?;

    // Update vault state
    let vault = &mut ctx.accounts.vault;
    vault.spent_amount = vault
        .spent_amount
        .checked_add(remaining)
        .ok_or(SeekerIOUError::ArithmeticOverflow)?;

    emit!(VaultWithdrawn {
        vault: vault.key(),
        owner: ctx.accounts.owner.key(),
        amount: remaining,
    });

    Ok(())
}
