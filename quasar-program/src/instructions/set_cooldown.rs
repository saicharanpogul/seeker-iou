use quasar_lang::prelude::*;
use quasar_spl::{InterfaceAccount, Mint};

use crate::errors::SeekerIOUError;
use crate::events::CooldownUpdated;
use crate::instructions::create_vault::MIN_COOLDOWN_SECONDS;
use crate::state::Vault;

#[derive(Accounts)]
pub struct SetCooldown<'info> {
    pub owner: &'info Signer,

    #[account(
        mut,
        seeds = [b"vault", owner, token_mint],
        bump = vault.bump,
        has_one = owner,
        has_one = token_mint,
        constraint = vault.is_active.get() @ SeekerIOUError::VaultNotActive,
    )]
    pub vault: &'info mut Account<Vault>,

    pub token_mint: &'info InterfaceAccount<Mint>,
}

impl<'info> SetCooldown<'info> {
    #[inline(always)]
    pub fn set_cooldown(&mut self, cooldown_seconds: u32) -> Result<(), ProgramError> {
        require!(
            cooldown_seconds >= MIN_COOLDOWN_SECONDS,
            SeekerIOUError::CooldownTooShort
        );

        let old_cooldown = self.vault.cooldown_seconds.get();
        self.vault.cooldown_seconds = cooldown_seconds.into();

        emit!(CooldownUpdated {
            vault: *self.vault.address(),
            owner: *self.owner.address(),
            old_cooldown,
            new_cooldown: cooldown_seconds,
        });

        Ok(())
    }
}
