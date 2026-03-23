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
}
