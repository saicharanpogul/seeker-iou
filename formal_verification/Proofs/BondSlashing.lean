import Proofs.State

open QEDGen.Solana

-- P9: Slash amount is bounded by min(bond, iou_amount)
def settleFailTransition (s : VaultState) (iou_amount nonce : Nat) : Option (VaultState × Nat) :=
  if s.is_active = true
    ∧ nonce > s.current_nonce
    ∧ iou_amount > 0
    ∧ s.available < iou_amount
  then
    let slash := min s.bond iou_amount
    some ({ s with
      spent_amount := s.spent_amount + slash,
      total_slashed := s.total_slashed + slash,
      current_nonce := nonce
    }, slash)
  else none

theorem slash_bounded_by_bond (s : VaultState) (iou_amount nonce : Nat) (s' : VaultState) (slash : Nat)
    (h : settleFailTransition s iou_amount nonce = some (s', slash)) :
    slash ≤ s.bond := by
  unfold settleFailTransition at h
  by_cases h_cond : s.is_active = true ∧ nonce > s.current_nonce ∧ iou_amount > 0 ∧ s.available < iou_amount
  · simp only [if_pos h_cond] at h
    have h_eq := Option.some.inj h
    have h_slash : slash = min s.bond iou_amount := (Prod.mk.inj h_eq).2.symm
    rw [h_slash]
    exact Nat.min_le_left s.bond iou_amount
  · simp only [if_neg h_cond] at h
    exact Option.noConfusion h

theorem slash_bounded_by_amount (s : VaultState) (iou_amount nonce : Nat) (s' : VaultState) (slash : Nat)
    (h : settleFailTransition s iou_amount nonce = some (s', slash)) :
    slash ≤ iou_amount := by
  unfold settleFailTransition at h
  by_cases h_cond : s.is_active = true ∧ nonce > s.current_nonce ∧ iou_amount > 0 ∧ s.available < iou_amount
  · simp only [if_pos h_cond] at h
    have h_eq := Option.some.inj h
    have h_slash : slash = min s.bond iou_amount := (Prod.mk.inj h_eq).2.symm
    rw [h_slash]
    exact Nat.min_le_right s.bond iou_amount
  · simp only [if_neg h_cond] at h
    exact Option.noConfusion h

-- P10: Failed settlement increments total_failed
structure ReputationTransition where
  pre  : ReputationState
  post : ReputationState

def failedSettlementReputation (r : ReputationState) : ReputationState :=
  { r with
    total_issued := r.total_issued + 1,
    total_failed := r.total_failed + 1
  }

theorem failure_updates_reputation (r : ReputationState) :
    (failedSettlementReputation r).total_failed = r.total_failed + 1 := by
  unfold failedSettlementReputation
  rfl
