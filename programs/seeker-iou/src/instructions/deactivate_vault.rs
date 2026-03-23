use anchor_lang::prelude::*;

use crate::errors::SeekerIOUError;
use crate::events::VaultDeactivated;
use crate::state::Vault;

#[derive(Accounts)]
pub struct DeactivateVault<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref(), vault.token_mint.as_ref()],
        bump = vault.bump,
        has_one = owner,
        constraint = vault.is_active @ SeekerIOUError::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,
}

pub fn handler(ctx: Context<DeactivateVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    vault.is_active = false;
    vault.deactivated_at = clock.unix_timestamp;

    emit!(VaultDeactivated {
        vault: vault.key(),
        owner: ctx.accounts.owner.key(),
    });

    Ok(())
}
