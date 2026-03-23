use quasar_svm::{Pubkey, QuasarSvm, SPL_TOKEN_PROGRAM_ID, SPL_ASSOCIATED_TOKEN_PROGRAM_ID};
use seeker_iou_quasar_client::*;
use solana_address::Address;

fn program_id() -> Pubkey {
    Pubkey::new_from_array(<[u8; 32]>::try_from(seeker_iou_quasar_client::ID.as_ref()).unwrap())
}

fn setup() -> QuasarSvm {
    let elf = include_bytes!("../../../target/deploy/seeker_iou_quasar.so");
    QuasarSvm::new().with_program(&program_id(), elf)
}

fn derive_vault_pda(owner: &Pubkey, token_mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"vault", owner.as_ref(), token_mint.as_ref()],
        &program_id(),
    )
}

fn derive_reputation_pda(sgt_mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"reputation", sgt_mint.as_ref()], &program_id())
}

fn addr(pk: &Pubkey) -> Address {
    Address::from(pk.to_bytes())
}

fn system_program_addr() -> Address {
    Address::from(quasar_svm::system_program::ID.to_bytes())
}

fn token_program_addr() -> Address {
    Address::from(SPL_TOKEN_PROGRAM_ID.to_bytes())
}

fn ata_program_addr() -> Address {
    Address::from(SPL_ASSOCIATED_TOKEN_PROGRAM_ID.to_bytes())
}

#[test]
fn test_create_vault_and_deposit() {
    let _svm = setup();

    let owner = Pubkey::new_unique();
    let token_mint = Pubkey::new_unique();
    let sgt_mint = Pubkey::new_unique();

    let (vault_pda, _) = derive_vault_pda(&owner, &token_mint);
    let (reputation_pda, _) = derive_reputation_pda(&sgt_mint);

    // Create mock accounts for the token mint and SGT
    let sgt_token_account = Pubkey::new_unique();
    let vault_token_account = Pubkey::new_unique();

    let ix: solana_instruction::Instruction = CreateVaultInstruction {
        owner: addr(&owner),
        vault: addr(&vault_pda),
        token_mint: addr(&token_mint),
        vault_token_account: addr(&vault_token_account),
        sgt_token_account: addr(&sgt_token_account),
        sgt_mint: addr(&sgt_mint),
        reputation: addr(&reputation_pda),
        system_program: system_program_addr(),
        token_program: token_program_addr(),
        ata_program: ata_program_addr(),
        reserve_ratio_bps: 3000,
        cooldown_seconds: 3600,
    }
    .into();

    // For now, verify the instruction builds correctly
    assert_eq!(ix.data[0], 0); // discriminator 0 = create_vault
    assert_eq!(ix.accounts.len(), 10);

    // Verify deposit instruction builds
    let deposit_ix: solana_instruction::Instruction = DepositInstruction {
        owner: addr(&owner),
        vault: addr(&vault_pda),
        token_mint: addr(&token_mint),
        owner_token_account: addr(&Pubkey::new_unique()),
        vault_token_account: addr(&vault_token_account),
        token_program: token_program_addr(),
        amount: 1_000_000_000,
    }
    .into();

    assert_eq!(deposit_ix.data[0], 1); // discriminator 1 = deposit
    assert_eq!(
        u64::from_le_bytes(deposit_ix.data[1..9].try_into().unwrap()),
        1_000_000_000
    );
}

#[test]
fn test_settle_iou_instruction_building() {
    let settler = Pubkey::new_unique();
    let owner = Pubkey::new_unique();
    let token_mint = Pubkey::new_unique();
    let sgt_mint = Pubkey::new_unique();
    let recipient = Pubkey::new_unique();

    let (vault_pda, _) = derive_vault_pda(&owner, &token_mint);
    let (reputation_pda, _) = derive_reputation_pda(&sgt_mint);

    // Build a dummy IOU message (217 bytes)
    let mut iou_message = vec![0u8; 217];
    iou_message[0] = 1; // version
    iou_message[1..33].copy_from_slice(&vault_pda.to_bytes());
    iou_message[33..65].copy_from_slice(&owner.to_bytes());
    iou_message[65..97].copy_from_slice(&recipient.to_bytes());
    iou_message[97..129].copy_from_slice(&token_mint.to_bytes());
    iou_message[129..137].copy_from_slice(&100_000_000u64.to_le_bytes()); // amount
    iou_message[137..145].copy_from_slice(&1u64.to_le_bytes()); // nonce
    iou_message[145..153].copy_from_slice(&0i64.to_le_bytes()); // expiry
    iou_message[153..185].copy_from_slice(&sgt_mint.to_bytes());
    // memo: 32 zero bytes already

    let signature = vec![0xABu8; 64];

    let ix: solana_instruction::Instruction = SettleIouInstruction {
        settler: addr(&settler),
        vault: addr(&vault_pda),
        owner: addr(&owner),
        token_mint: addr(&token_mint),
        vault_token_account: addr(&Pubkey::new_unique()),
        recipient: addr(&recipient),
        recipient_token_account: addr(&Pubkey::new_unique()),
        settlement_record: addr(&Pubkey::new_unique()),
        reputation: addr(&reputation_pda),
        sgt_mint: addr(&sgt_mint),
        instructions_sysvar: solana_address::address!("Sysvar1nstructions1111111111111111111111111"),
        system_program: system_program_addr(),
        token_program: token_program_addr(),
        ata_program: ata_program_addr(),
        iou_message: iou_message.clone(),
        signature: signature.clone(),
        nonce: 1,
    }
    .into();

    assert_eq!(ix.data[0], 2); // discriminator 2 = settle_iou
    assert_eq!(ix.accounts.len(), 14);

    // Verify IOU message is embedded in data
    // Format: [discriminator(1)] [iou_message(217)] [signature(64)] [nonce(8)]
    let data_iou = &ix.data[1..218];
    assert_eq!(data_iou, &iou_message[..]);
    let data_sig = &ix.data[218..282];
    assert_eq!(data_sig, &signature[..]);
    let data_nonce = u64::from_le_bytes(ix.data[282..290].try_into().unwrap());
    assert_eq!(data_nonce, 1);
}

#[test]
fn test_deactivate_reactivate_instruction_building() {
    let owner = Pubkey::new_unique();
    let token_mint = Pubkey::new_unique();
    let (vault_pda, _) = derive_vault_pda(&owner, &token_mint);

    let deactivate_ix: solana_instruction::Instruction = DeactivateVaultInstruction {
        owner: addr(&owner),
        vault: addr(&vault_pda),
        token_mint: addr(&token_mint),
    }
    .into();

    assert_eq!(deactivate_ix.data[0], 3);
    assert_eq!(deactivate_ix.accounts.len(), 3);

    let reactivate_ix: solana_instruction::Instruction = ReactivateVaultInstruction {
        owner: addr(&owner),
        vault: addr(&vault_pda),
        token_mint: addr(&token_mint),
    }
    .into();

    assert_eq!(reactivate_ix.data[0], 4);
}

#[test]
fn test_set_reserve_ratio_instruction_building() {
    let owner = Pubkey::new_unique();
    let token_mint = Pubkey::new_unique();
    let (vault_pda, _) = derive_vault_pda(&owner, &token_mint);

    let ix: solana_instruction::Instruction = SetReserveRatioInstruction {
        owner: addr(&owner),
        vault: addr(&vault_pda),
        token_mint: addr(&token_mint),
        reserve_ratio_bps: 5000,
    }
    .into();

    assert_eq!(ix.data[0], 6);
    let ratio = u16::from_le_bytes(ix.data[1..3].try_into().unwrap());
    assert_eq!(ratio, 5000);
}

#[test]
fn test_set_cooldown_instruction_building() {
    let owner = Pubkey::new_unique();
    let token_mint = Pubkey::new_unique();
    let (vault_pda, _) = derive_vault_pda(&owner, &token_mint);

    let ix: solana_instruction::Instruction = SetCooldownInstruction {
        owner: addr(&owner),
        vault: addr(&vault_pda),
        token_mint: addr(&token_mint),
        cooldown_seconds: 7200,
    }
    .into();

    assert_eq!(ix.data[0], 7);
    let cooldown = u32::from_le_bytes(ix.data[1..5].try_into().unwrap());
    assert_eq!(cooldown, 7200);
}

#[test]
fn test_event_discriminators() {
    assert_eq!(VAULT_CREATED_EVENT_DISCRIMINATOR, &[0]);
    assert_eq!(DEPOSITED_EVENT_DISCRIMINATOR, &[1]);
    assert_eq!(I_O_U_SETTLED_EVENT_DISCRIMINATOR, &[2]);
    assert_eq!(I_O_U_FAILED_EVENT_DISCRIMINATOR, &[3]);
    assert_eq!(VAULT_DEACTIVATED_EVENT_DISCRIMINATOR, &[4]);
    assert_eq!(VAULT_REACTIVATED_EVENT_DISCRIMINATOR, &[5]);
    assert_eq!(VAULT_WITHDRAWN_EVENT_DISCRIMINATOR, &[6]);
    assert_eq!(RESERVE_RATIO_UPDATED_EVENT_DISCRIMINATOR, &[7]);
    assert_eq!(COOLDOWN_UPDATED_EVENT_DISCRIMINATOR, &[8]);
}

#[test]
fn test_withdraw_instruction_building() {
    let owner = Pubkey::new_unique();
    let token_mint = Pubkey::new_unique();
    let (vault_pda, _) = derive_vault_pda(&owner, &token_mint);

    let ix: solana_instruction::Instruction = WithdrawInstruction {
        owner: addr(&owner),
        vault: addr(&vault_pda),
        token_mint: addr(&token_mint),
        vault_token_account: addr(&Pubkey::new_unique()),
        owner_token_account: addr(&Pubkey::new_unique()),
        token_program: token_program_addr(),
    }
    .into();

    assert_eq!(ix.data[0], 5);
    assert_eq!(ix.accounts.len(), 6);
}
