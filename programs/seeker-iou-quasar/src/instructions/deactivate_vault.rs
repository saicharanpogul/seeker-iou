use quasar_lang::prelude::*;

use crate::errors::SeekerIOUError;
use crate::events::VaultDeactivated;
use crate::state::Vault;

#[derive(Accounts)]
pub struct DeactivateVault<'info> {
    pub owner: &'info Signer,

    #[account(
        mut,
        seeds = [b"vault", owner, vault.token_mint],
        bump = vault.bump,
        has_one = owner,
        constraint = vault.is_active.get() @ SeekerIOUError::VaultNotActive,
    )]
    pub vault: &'info mut Account<Vault>,
}

impl<'info> DeactivateVault<'info> {
    #[inline(always)]
    pub fn deactivate(&mut self) -> Result<(), ProgramError> {
        let clock = Clock::get()?;
        self.vault.is_active = false;
        self.vault.deactivated_at = clock.unix_timestamp;

        emit!(VaultDeactivated {
            vault: *self.vault.address(),
            owner: *self.owner.address(),
        });

        Ok(())
    }
}
