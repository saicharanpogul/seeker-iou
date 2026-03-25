import Proofs.State

open QEDGen.Solana

-- P1: Only vault owner can withdraw
def withdrawTransition (s : VaultState) (signer : Pubkey) (clock_ts : Nat) : Option VaultState :=
  if signer = s.owner
    ∧ s.is_active = false
    ∧ clock_ts >= s.deactivated_at + s.cooldown_seconds
    ∧ s.remaining > 0
  then
    some { s with spent_amount := s.spent_amount + s.remaining }
  else none

theorem withdraw_owner_only (s : VaultState) (signer : Pubkey) (clock_ts : Nat)
    (h : withdrawTransition s signer clock_ts ≠ none) :
    signer = s.owner := by
  unfold withdrawTransition at h
  by_cases hc : signer = s.owner ∧ s.is_active = false ∧ clock_ts >= s.deactivated_at + s.cooldown_seconds ∧ s.remaining > 0
  · exact hc.1
  · simp only [if_neg hc] at h
    exact absurd rfl h

-- P2: Only vault owner can deactivate
def deactivateTransition (s : VaultState) (signer : Pubkey) (now : Nat) : Option VaultState :=
  if signer = s.owner ∧ s.is_active = true
  then some { s with is_active := false, deactivated_at := now }
  else none

theorem deactivate_owner_only (s : VaultState) (signer : Pubkey) (now : Nat)
    (h : deactivateTransition s signer now ≠ none) :
    signer = s.owner := by
  unfold deactivateTransition at h
  by_cases hc : signer = s.owner ∧ s.is_active = true
  · exact hc.1
  · simp only [if_neg hc] at h
    exact absurd rfl h

-- P3: set_reserve_ratio requires active vault
def setReserveRatioTransition (s : VaultState) (signer : Pubkey) (bps : Nat) : Option VaultState :=
  if signer = s.owner ∧ s.is_active = true ∧ bps ≤ 10000
  then some { s with reserve_ratio_bps := bps }
  else none

theorem set_reserve_ratio_requires_active (s : VaultState) (signer : Pubkey) (bps : Nat)
    (h : setReserveRatioTransition s signer bps ≠ none) :
    s.is_active = true := by
  unfold setReserveRatioTransition at h
  by_cases hc : signer = s.owner ∧ s.is_active = true ∧ bps ≤ 10000
  · exact hc.2.1
  · simp only [if_neg hc] at h
    exact absurd rfl h

-- P3b: set_cooldown requires active vault
def setCooldownTransition (s : VaultState) (signer : Pubkey) (secs : Nat) : Option VaultState :=
  if signer = s.owner ∧ s.is_active = true ∧ secs ≥ 300
  then some { s with cooldown_seconds := secs }
  else none

theorem set_cooldown_requires_active (s : VaultState) (signer : Pubkey) (secs : Nat)
    (h : setCooldownTransition s signer secs ≠ none) :
    s.is_active = true := by
  unfold setCooldownTransition at h
  by_cases hc : signer = s.owner ∧ s.is_active = true ∧ secs ≥ 300
  · exact hc.2.1
  · simp only [if_neg hc] at h
    exact absurd rfl h
