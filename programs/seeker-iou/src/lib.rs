use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod iou;
pub mod state;

use instructions::*;

declare_id!("6wz3cfQKtxWS4KLztGyD4BCM8RUrfXiNyxWgYi25p5Eo");

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
}
