import Proofs.State

open QEDGen.Solana

-- P4: Nonce strictly increases after settlement
def settleTransition (s : VaultState) (nonce : Nat) (amount : Nat) : Option VaultState :=
  if s.is_active = true
    ∧ nonce > s.current_nonce
    ∧ amount > 0
  then some { s with current_nonce := nonce }
  else none

theorem nonce_strictly_increases (s s' : VaultState) (nonce amount : Nat)
    (h : settleTransition s nonce amount = some s') :
    s'.current_nonce > s.current_nonce := by
  unfold settleTransition at h
  by_cases h_cond : s.is_active = true ∧ nonce > s.current_nonce ∧ amount > 0
  · simp only [if_pos h_cond] at h
    have h_eq := Option.some.inj h
    rw [← h_eq]
    dsimp only []
    exact h_cond.2.1
  · simp only [if_neg h_cond] at h
    exact Option.noConfusion h

-- P12: No settlement when vault is inactive
theorem no_settle_when_inactive (s : VaultState) (nonce amount : Nat)
    (h_inactive : s.is_active = false) :
    settleTransition s nonce amount = none := by
  unfold settleTransition
  have h_cond : ¬(s.is_active = true ∧ nonce > s.current_nonce ∧ amount > 0) := by
    intro hc
    rw [h_inactive] at hc
    simp at hc
  simp only [if_neg h_cond]
