use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::errors::SeekerIOUError;
use crate::events::VaultCreated;
use crate::state::{ReputationAccount, Vault};

/// Known SGT mint authority
pub const SGT_MINT_AUTHORITY: &str = "GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4";

/// Default cooldown in seconds (1 hour)
pub const DEFAULT_COOLDOWN_SECONDS: u32 = 3600;

#[derive(Accounts)]
pub struct CreateVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + Vault::INIT_SPACE,
        seeds = [b"vault", owner.key().as_ref(), token_mint.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = owner,
        associated_token::mint = token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    /// The user's SGT token account (must have balance > 0)
    #[account(
        constraint = sgt_token_account.owner == owner.key() @ SeekerIOUError::InvalidSgtOwner,
        constraint = sgt_token_account.amount > 0 @ SeekerIOUError::InvalidSgtBalance,
        constraint = sgt_token_account.mint == sgt_mint.key(),
    )]
    pub sgt_token_account: InterfaceAccount<'info, TokenAccount>,

    /// The SGT mint - verify it has the correct mint authority
    #[account(
        constraint = sgt_mint.mint_authority.is_some()
            && sgt_mint.mint_authority.unwrap() == SGT_MINT_AUTHORITY.parse::<Pubkey>().unwrap()
            @ SeekerIOUError::InvalidSgtMintAuthority,
    )]
    pub sgt_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + ReputationAccount::INIT_SPACE,
        seeds = [b"reputation", sgt_mint.key().as_ref()],
        bump,
    )]
    pub reputation: Account<'info, ReputationAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<CreateVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    vault.owner = ctx.accounts.owner.key();
    vault.token_mint = ctx.accounts.token_mint.key();
    vault.token_account = ctx.accounts.vault_token_account.key();
    vault.deposited_amount = 0;
    vault.spent_amount = 0;
    vault.current_nonce = 0;
    vault.sgt_mint = ctx.accounts.sgt_mint.key();
    vault.created_at = clock.unix_timestamp;
    vault.is_active = true;
    vault.deactivated_at = 0;
    vault.cooldown_seconds = DEFAULT_COOLDOWN_SECONDS;
    vault.bump = ctx.bumps.vault;

    let reputation = &mut ctx.accounts.reputation;
    if reputation.created_at == 0 {
        reputation.sgt_mint = ctx.accounts.sgt_mint.key();
        reputation.total_issued = 0;
        reputation.total_settled = 0;
        reputation.total_failed = 0;
        reputation.total_volume = 0;
        reputation.last_failure_at = 0;
        reputation.created_at = clock.unix_timestamp;
        reputation.bump = ctx.bumps.reputation;
    }

    emit!(VaultCreated {
        owner: ctx.accounts.owner.key(),
        token_mint: ctx.accounts.token_mint.key(),
        vault: vault.key(),
        sgt_mint: ctx.accounts.sgt_mint.key(),
    });

    Ok(())
}
