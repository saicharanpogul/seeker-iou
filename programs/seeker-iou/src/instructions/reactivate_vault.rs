use anchor_lang::prelude::*;

use crate::errors::SeekerIOUError;
use crate::events::VaultReactivated;
use crate::state::Vault;

#[derive(Accounts)]
pub struct ReactivateVault<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref(), vault.token_mint.as_ref()],
        bump = vault.bump,
        has_one = owner,
        constraint = !vault.is_active @ SeekerIOUError::VaultStillActive,
    )]
    pub vault: Account<'info, Vault>,
}

pub fn handler(ctx: Context<ReactivateVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    vault.is_active = true;
    vault.deactivated_at = 0;

    emit!(VaultReactivated {
        vault: vault.key(),
        owner: ctx.accounts.owner.key(),
    });

    Ok(())
}
