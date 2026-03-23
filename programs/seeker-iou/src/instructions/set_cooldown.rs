use anchor_lang::prelude::*;

use crate::errors::SeekerIOUError;
use crate::events::CooldownUpdated;
use crate::instructions::create_vault::MIN_COOLDOWN_SECONDS;
use crate::state::Vault;

#[derive(Accounts)]
pub struct SetCooldown<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref(), vault.token_mint.as_ref()],
        bump = vault.bump,
        has_one = owner,
    )]
    pub vault: Account<'info, Vault>,
}

pub fn handler(ctx: Context<SetCooldown>, cooldown_seconds: u32) -> Result<()> {
    require!(
        cooldown_seconds >= MIN_COOLDOWN_SECONDS,
        SeekerIOUError::CooldownTooShort
    );

    let vault = &mut ctx.accounts.vault;
    let old_cooldown = vault.cooldown_seconds;
    vault.cooldown_seconds = cooldown_seconds;

    emit!(CooldownUpdated {
        vault: vault.key(),
        owner: ctx.accounts.owner.key(),
        old_cooldown,
        new_cooldown: cooldown_seconds,
    });

    Ok(())
}
