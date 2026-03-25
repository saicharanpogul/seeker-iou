import Proofs.State
import Proofs.Authorization
import Mathlib.Tactic

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
  unfold depositTransition at h; split_ifs at h with h_cond
  · obtain rfl := Option.some.inj h
    unfold conservation at h_inv ⊢
    exact le_trans h_inv (Nat.le_add_right _ _)

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
  unfold settleSuccessTransition at h; split_ifs at h with h_cond
  · obtain rfl := Option.some.inj h
    show s.spent_amount + amount ≤ s.deposited_amount
    unfold conservation at h_inv
    unfold VaultState.available VaultState.remaining VaultState.bond at h_cond
    obtain ⟨_, _, _, h_avail, _⟩ := h_cond
    -- h_avail : amount ≤ s.deposited_amount - s.spent_amount - s.remaining * s.reserve_ratio_bps / 10000
    calc s.spent_amount + amount
        ≤ s.spent_amount + (s.deposited_amount - s.spent_amount - s.remaining * s.reserve_ratio_bps / 10000) :=
          Nat.add_le_add_left h_avail _
      _ ≤ s.spent_amount + (s.deposited_amount - s.spent_amount) :=
          Nat.add_le_add_left (Nat.sub_le _ _) _
      _ = s.deposited_amount := Nat.add_sub_cancel' h_inv

-- P8: Withdraw preserves conservation
theorem withdraw_conservation (s s' : VaultState) (signer : Pubkey) (clock_ts : Nat)
    (h_inv : conservation s)
    (h : withdrawTransition s signer clock_ts = some s') :
    conservation s' := by
  unfold withdrawTransition at h; split_ifs at h with h_cond
  · obtain rfl := Option.some.inj h
    show s.spent_amount + s.remaining ≤ s.deposited_amount
    unfold conservation at h_inv; unfold VaultState.remaining
    rw [Nat.add_sub_cancel' h_inv]
