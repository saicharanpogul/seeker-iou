use quasar_lang::prelude::*;

#[event(discriminator = 0)]
pub struct VaultCreated {
    pub owner: Address,
    pub token_mint: Address,
    pub vault: Address,
    pub sgt_mint: Address,
}

#[event(discriminator = 1)]
pub struct Deposited {
    pub vault: Address,
    pub amount: u64,
    pub new_total: u64,
}

#[event(discriminator = 2)]
pub struct IOUSettled {
    pub vault: Address,
    pub recipient: Address,
    pub amount: u64,
    pub nonce: u64,
    pub settler: Address,
}

#[event(discriminator = 3)]
pub struct IOUFailed {
    pub vault: Address,
    pub recipient: Address,
    pub amount: u64,
    pub nonce: u64,
    pub settler: Address,
    pub slash_amount: u64,
}

#[event(discriminator = 4)]
pub struct VaultDeactivated {
    pub vault: Address,
    pub owner: Address,
}

#[event(discriminator = 5)]
pub struct VaultReactivated {
    pub vault: Address,
    pub owner: Address,
}

#[event(discriminator = 6)]
pub struct VaultWithdrawn {
    pub vault: Address,
    pub owner: Address,
    pub amount: u64,
}

#[event(discriminator = 7)]
pub struct ReserveRatioUpdated {
    pub vault: Address,
    pub owner: Address,
    pub old_ratio_bps: u16,
    pub new_ratio_bps: u16,
}

#[event(discriminator = 8)]
pub struct CooldownUpdated {
    pub vault: Address,
    pub owner: Address,
    pub old_cooldown: u32,
    pub new_cooldown: u32,
}
