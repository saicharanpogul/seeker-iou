import Proofs.State
import Proofs.Authorization

open QEDGen.Solana

-- P6: Deposit preserves conservation
def depositTransition (s : VaultState) (amount : Nat) : Option VaultState :=
  if amount > 0 ∧ s.is_active = true ∧ s.deposited_amount + amount ≤ U64_MAX
  then some { s with deposited_amount := s.deposited_amount + amount }
  else none

theorem deposit_conservation (s s' : VaultState) (amount : Nat)
    (h_inv : conservation s)
    (h : depositTransition s amount = some s') :
    conservation s' := by
  unfold depositTransition at h
  by_cases h_cond : amount > 0 ∧ s.is_active = true ∧ s.deposited_amount + amount ≤ U64_MAX
  · simp only [if_pos h_cond] at h
    have h_eq := Option.some.inj h
    subst h_eq
    unfold conservation at h_inv ⊢
    dsimp only []
    exact Nat.le_trans h_inv (Nat.le_add_right s.deposited_amount amount)
  · simp only [if_neg h_cond] at h
    exact Option.noConfusion h

-- P7: Settlement (success path) preserves conservation
def settleSuccessTransition (s : VaultState) (amount nonce : Nat) : Option VaultState :=
  if s.is_active = true
    ∧ nonce > s.current_nonce
    ∧ amount > 0
    ∧ s.available >= amount
    ∧ s.spent_amount + amount ≤ U64_MAX
  then some { s with
    spent_amount := s.spent_amount + amount,
    current_nonce := nonce
  }
  else none

theorem settle_success_conservation (s s' : VaultState) (amount nonce : Nat)
    (h_inv : conservation s)
    (h : settleSuccessTransition s amount nonce = some s') :
    conservation s' := by
  unfold settleSuccessTransition at h
  by_cases h_cond : s.is_active = true ∧ nonce > s.current_nonce ∧ amount > 0 ∧ s.available >= amount ∧ s.spent_amount + amount ≤ U64_MAX
  · simp only [if_pos h_cond] at h
    have h_eq := Option.some.inj h
    subst h_eq
    unfold conservation at h_inv ⊢
    dsimp only []
    -- Goal: s.deposited_amount ≥ s.spent_amount + amount
    have h_avail := h_cond.2.2.2.1
    unfold VaultState.available at h_avail
    have h_rem_ge : s.remaining ≥ amount :=
      Nat.le_trans h_avail (Nat.sub_le s.remaining s.bond)
    unfold VaultState.remaining at h_rem_ge
    -- h_rem_ge: s.deposited_amount - s.spent_amount ≥ amount
    -- h_inv: s.deposited_amount ≥ s.spent_amount (i.e. s.spent_amount ≤ s.deposited_amount)
    have := Nat.add_le_of_le_sub h_inv h_rem_ge
    rw [Nat.add_comm] at this
    exact this
  · simp only [if_neg h_cond] at h
    exact Option.noConfusion h

-- P8: Withdraw preserves conservation
theorem withdraw_conservation (s s' : VaultState) (signer : Pubkey) (clock_ts : Nat)
    (h_inv : conservation s)
    (h : withdrawTransition s signer clock_ts = some s') :
    conservation s' := by
  unfold withdrawTransition at h
  by_cases h_cond : signer = s.owner ∧ s.is_active = false ∧ clock_ts >= s.deactivated_at + s.cooldown_seconds ∧ s.remaining > 0
  · simp only [if_pos h_cond] at h
    have h_eq := Option.some.inj h
    subst h_eq
    unfold conservation at h_inv ⊢
    dsimp only []
    unfold VaultState.remaining
    -- Goal: s.deposited_amount ≥ s.spent_amount + (s.deposited_amount - s.spent_amount)
    -- h_inv: s.deposited_amount ≥ s.spent_amount
    have := Nat.add_sub_cancel' h_inv
    rw [this]
    exact Nat.le_refl s.deposited_amount
  · simp only [if_neg h_cond] at h
    exact Option.noConfusion h
