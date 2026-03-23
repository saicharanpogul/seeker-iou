use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod iou;
pub mod state;

use instructions::*;

declare_id!("Appq4U1rTS4tCo4E84qhQs777z3awXf6K55amgnZ5srC");

#[program]
pub mod seeker_iou {
    use super::*;

    pub fn create_vault(ctx: Context<CreateVault>) -> Result<()> {
        instructions::create_vault::handler(ctx)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    pub fn settle_iou(
        ctx: Context<SettleIOU>,
        iou_message: Vec<u8>,
        signature: [u8; 64],
        nonce: u64,
    ) -> Result<()> {
        instructions::settle_iou::handler(ctx, iou_message, signature, nonce)
    }

    pub fn deactivate_vault(ctx: Context<DeactivateVault>) -> Result<()> {
        instructions::deactivate_vault::handler(ctx)
    }

    pub fn reactivate_vault(ctx: Context<ReactivateVault>) -> Result<()> {
        instructions::reactivate_vault::handler(ctx)
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        instructions::withdraw::handler(ctx)
    }
}
