use anchor_lang::prelude::*;

use crate::errors::SeekerIOUError;
use crate::events::ReserveRatioUpdated;
use crate::instructions::create_vault::MAX_RESERVE_RATIO_BPS;
use crate::state::Vault;

#[derive(Accounts)]
pub struct SetReserveRatio<'info> {
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

pub fn handler(ctx: Context<SetReserveRatio>, reserve_ratio_bps: u16) -> Result<()> {
    require!(
        reserve_ratio_bps <= MAX_RESERVE_RATIO_BPS,
        SeekerIOUError::InvalidReserveRatio
    );

    let vault = &mut ctx.accounts.vault;
    let old_ratio = vault.reserve_ratio_bps;
    vault.reserve_ratio_bps = reserve_ratio_bps;

    emit!(ReserveRatioUpdated {
        vault: vault.key(),
        owner: ctx.accounts.owner.key(),
        old_ratio_bps: old_ratio,
        new_ratio_bps: reserve_ratio_bps,
    });

    Ok(())
}
