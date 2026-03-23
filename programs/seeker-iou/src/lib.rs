use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod iou;
pub mod state;

declare_id!("6wz3cfQKtxWS4KLztGyD4BCM8RUrfXiNyxWgYi25p5Eo");

#[program]
pub mod seeker_iou {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
