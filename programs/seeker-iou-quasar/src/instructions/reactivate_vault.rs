use quasar_lang::prelude::*;

use crate::errors::SeekerIOUError;
use crate::events::VaultReactivated;
use crate::state::Vault;

#[derive(Accounts)]
pub struct ReactivateVault<'info> {
    pub owner: &'info Signer,

    #[account(
        mut,
        seeds = [b"vault", owner, vault.token_mint],
        bump = vault.bump,
        has_one = owner,
        constraint = !vault.is_active.get() @ SeekerIOUError::VaultStillActive,
    )]
    pub vault: &'info mut Account<Vault>,
}

impl<'info> ReactivateVault<'info> {
    #[inline(always)]
    pub fn reactivate(&mut self) -> Result<(), ProgramError> {
        self.vault.is_active = true;
        self.vault.deactivated_at = 0;

        emit!(VaultReactivated {
            vault: *self.vault.address(),
            owner: *self.owner.address(),
        });

        Ok(())
    }
}
