#![cfg_attr(not(test), no_std)]

use quasar_lang::prelude::*;

mod errors;
mod events;
mod instructions;
mod iou;
mod state;

use instructions::*;

declare_id!("Appq4U1rTS4tCo4E84qhQs777z3awXf6K55amgnZ5srC");

#[program]
mod seeker_iou {
    use super::*;

    #[instruction(discriminator = 0)]
    pub fn create_vault(
        ctx: Ctx<CreateVault>,
        reserve_ratio_bps: u16,
        cooldown_seconds: u32,
    ) -> Result<(), ProgramError> {
        ctx.accounts.create_vault(reserve_ratio_bps, cooldown_seconds, &ctx.bumps)
    }

    #[instruction(discriminator = 1)]
    pub fn deposit(ctx: Ctx<Deposit>, amount: u64) -> Result<(), ProgramError> {
        ctx.accounts.deposit(amount)
    }

    #[instruction(discriminator = 2)]
    pub fn settle_iou(
        ctx: Ctx<SettleIOU>,
        iou_message: &[u8],
        signature: &[u8],
        nonce: u64,
    ) -> Result<(), ProgramError> {
        ctx.accounts.settle(iou_message, signature, nonce, &ctx.bumps)
    }

    #[instruction(discriminator = 3)]
    pub fn deactivate_vault(ctx: Ctx<DeactivateVault>) -> Result<(), ProgramError> {
        ctx.accounts.deactivate()
    }

    #[instruction(discriminator = 4)]
    pub fn reactivate_vault(ctx: Ctx<ReactivateVault>) -> Result<(), ProgramError> {
        ctx.accounts.reactivate()
    }

    #[instruction(discriminator = 5)]
    pub fn withdraw(ctx: Ctx<Withdraw>) -> Result<(), ProgramError> {
        ctx.accounts.withdraw(&ctx.bumps)
    }

    #[instruction(discriminator = 6)]
    pub fn set_reserve_ratio(
        ctx: Ctx<SetReserveRatio>,
        reserve_ratio_bps: u16,
    ) -> Result<(), ProgramError> {
        ctx.accounts.set_reserve_ratio(reserve_ratio_bps)
    }

    #[instruction(discriminator = 7)]
    pub fn set_cooldown(ctx: Ctx<SetCooldown>, cooldown_seconds: u32) -> Result<(), ProgramError> {
        ctx.accounts.set_cooldown(cooldown_seconds)
    }
}
