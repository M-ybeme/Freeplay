import { describe, expect, it } from "vitest";
import { reducer, type GameState } from "./useColorSort";
import { DIFFICULTIES, isBoardSolved, type Board } from "./logic";

const EASY = DIFFICULTIES[0];

/** A tiny, hand-built two-color/one-helper state - deterministic, no generator/solver involved. */
function fixedState(board: Board, overrides: Partial<GameState> = {}): GameState {
  return {
    difficulty: EASY,
    initialBoard: board.map((t) => t.slice()),
    board,
    selectedTube: null,
    moveCount: 0,
    status: "playing",
    history: [],
    ...overrides,
  };
}

describe("reducer - select/pour and history", () => {
  it("a successful pour creates exactly one history entry", () => {
    const state = fixedState([[0, 0, 1, 1], []]);
    const afterSelect = reducer(state, { type: "select", index: 0 });
    const afterPour = reducer(afterSelect, { type: "select", index: 1 });
    expect(afterPour.history).toHaveLength(1);
    expect(afterPour.moveCount).toBe(1);
    // Top run on tube 0 is both 1s (length 2), so both move onto the empty tube.
    expect(afterPour.board).toEqual([[0, 0], [1, 1]]);
  });

  it("selecting and deselecting a tube does not create history", () => {
    const state = fixedState([[0, 0, 1, 1], []]);
    const selected = reducer(state, { type: "select", index: 0 });
    const deselected = reducer(selected, { type: "select", index: 0 });
    expect(deselected.history).toHaveLength(0);
    expect(deselected.selectedTube).toBeNull();
  });

  it("tapping an illegal destination does not create history (switches selection instead)", () => {
    // Tube 0 top is color 1, tube 1 top is color 0 - mismatched, illegal.
    const state = fixedState([[0, 1], [1, 0]]);
    const selected = reducer(state, { type: "select", index: 0 });
    const afterIllegalTap = reducer(selected, { type: "select", index: 1 });
    expect(afterIllegalTap.history).toHaveLength(0);
    expect(afterIllegalTap.moveCount).toBe(0);
    expect(afterIllegalTap.selectedTube).toBe(1); // switched source, not an error state
  });

  it("undo restores the previous board and decrements the move count", () => {
    const state = fixedState([[0, 0, 1, 1], []]);
    const afterPour = reducer(reducer(state, { type: "select", index: 0 }), { type: "select", index: 1 });
    expect(afterPour.moveCount).toBe(1);

    const afterUndo = reducer(afterPour, { type: "undo" });
    expect(afterUndo.board).toEqual([[0, 0, 1, 1], []]);
    expect(afterUndo.moveCount).toBe(0);
    expect(afterUndo.history).toHaveLength(0);
  });

  it("undo does not itself count as a move (a following pour becomes move 1 again, not move 2)", () => {
    const state = fixedState([[0, 0, 1, 1], []]);
    const afterPour = reducer(reducer(state, { type: "select", index: 0 }), { type: "select", index: 1 });
    const afterUndo = reducer(afterPour, { type: "undo" });
    const afterRepour = reducer(reducer(afterUndo, { type: "select", index: 0 }), { type: "select", index: 1 });
    expect(afterRepour.moveCount).toBe(1);
  });

  it("multiple undos in sequence step back through several moves", () => {
    let state = fixedState([[0, 1, 0, 1], [1, 0, 1, 0], []]);
    // Move 1: 2 -> pour nothing legal onto empty from a mixed tube works fine (moves whatever's on top).
    state = reducer(reducer(state, { type: "select", index: 0 }), { type: "select", index: 2 });
    const afterMove1 = state;
    state = reducer(reducer(state, { type: "select", index: 1 }), { type: "select", index: 0 });
    const afterMove2 = state;
    expect(state.moveCount).toBe(2);

    state = reducer(state, { type: "undo" });
    expect(state.board).toEqual(afterMove1.board);
    expect(state.moveCount).toBe(1);

    state = reducer(state, { type: "undo" });
    expect(state.moveCount).toBe(0);
    expect(state.history).toHaveLength(0);
    void afterMove2;
  });

  it("undo at the initial state is a no-op (empty history, nothing to restore)", () => {
    const state = fixedState([[0, 0, 1, 1], []]);
    const afterUndo = reducer(state, { type: "undo" });
    expect(afterUndo).toBe(state);
  });

  it("making a new move after undoing discards the abandoned future (A -> B -> C, undo, undo, X: history is [A, B])", () => {
    // initial=[[0,1],[1,0],[]]. Move1 (0->2) pours tube0's top 1 onto the
    // empty tube: board_1=[[0],[1,0],[1]]. From board_1, two *different*
    // legal moves exist - 0->1 (call it "C", the original path) and 1->0
    // (call it "X", the branch) - so this exercises a genuine fork, not an
    // accidental illegal-tap/selection-switch.
    let state = fixedState([[0, 1], [1, 0], []]);
    state = reducer(reducer(state, { type: "select", index: 0 }), { type: "select", index: 2 });
    const board1 = state.board;
    expect(state.moveCount).toBe(1);

    const stateAtBoard1 = state;
    const stateC = reducer(reducer(stateAtBoard1, { type: "select", index: 0 }), { type: "select", index: 1 });
    expect(stateC.moveCount).toBe(2);
    const boardC = stateC.board;

    const undoneToBoard1 = reducer(stateC, { type: "undo" });
    expect(undoneToBoard1.board).toEqual(board1);
    expect(undoneToBoard1.moveCount).toBe(1);

    const stateX = reducer(reducer(undoneToBoard1, { type: "select", index: 1 }), { type: "select", index: 0 });
    expect(stateX.moveCount).toBe(2);
    expect(stateX.board).not.toEqual(boardC); // a genuinely different move, not a re-play of C
    // history is [initial, board1] - undo only popped one level, not both.
    expect(stateX.history).toHaveLength(2);
    expect(stateX.history[0].board).toEqual(state.initialBoard);
    expect(stateX.history[1].board).toEqual(board1);

    // No redo path back to C exists - undoing from X only ever leads back
    // through board1 to the initial state, never to boardC.
    const backToBoard1 = reducer(stateX, { type: "undo" });
    expect(backToBoard1.board).toEqual(board1);
    const backToInitial = reducer(backToBoard1, { type: "undo" });
    expect(backToInitial.moveCount).toBe(0);
    expect(backToInitial.history).toHaveLength(0);
  });

  it("restart clears history and resets moves, independent of how many moves were made", () => {
    let state = fixedState([[0, 0, 1, 1], []]);
    state = reducer(reducer(state, { type: "select", index: 0 }), { type: "select", index: 1 });
    expect(state.history.length).toBeGreaterThan(0);

    const restarted = reducer(state, { type: "restart" });
    expect(restarted.history).toHaveLength(0);
    expect(restarted.moveCount).toBe(0);
    expect(restarted.board).toEqual(state.initialBoard);
  });

  it("a new puzzle (and, by the same action, a difficulty switch) clears history and resets moves", () => {
    let state = fixedState([[0, 0, 1, 1], []]);
    state = reducer(reducer(state, { type: "select", index: 0 }), { type: "select", index: 1 });
    expect(state.history.length).toBeGreaterThan(0);

    const fresh = reducer(state, { type: "new-puzzle", difficulty: EASY, rng: () => 0.42 });
    expect(fresh.history).toHaveLength(0);
    expect(fresh.moveCount).toBe(0);
    expect(fresh.status).toBe("playing");
  });

  it("undoing from a solved state returns to the immediately previous unsolved state", () => {
    // One move away from solved: pouring tube 1's single unit onto tube 0
    // completes tube 0 (4 units of color 0) and empties tube 1.
    const state = fixedState([[0, 0, 0], [0]]);
    expect(isBoardSolved(state.board)).toBe(false);

    const afterWin = reducer(reducer(state, { type: "select", index: 0 }), { type: "select", index: 1 });
    expect(afterWin.status).toBe("won");

    const afterUndo = reducer(afterWin, { type: "undo" });
    expect(afterUndo.status).toBe("playing");
    expect(afterUndo.board).toEqual(state.board);
    expect(afterUndo.moveCount).toBe(0);
  });

  // Best-move persistence lives in useColorSort's own useGameStorage-backed
  // effect, entirely outside this reducer - the "undo" action has no way to
  // reach or reset it (it isn't part of GameState at all), so a recorded
  // best cannot be erased by undoing. This project has no React hook-testing
  // library set up, so the end-to-end guarantee (win, see a new best
  // persist, undo, reload, best still there) is verified live in the
  // browser pass instead of faked here.
});
