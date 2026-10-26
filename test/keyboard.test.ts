import assert from "node:assert/strict";
import { test } from "vitest";
import { nextCard } from "../src/render/keyboard";

/** A card at a grid position: 3 columns of 100px, rows 80px apart. */
const card = (col: number, row: number) =>
  ({
    getBoundingClientRect: () => {
      const left = col * 110;
      const top = row * 90;
      return { left, top, right: left + 100, bottom: top + 80, width: 100, height: 80 };
    },
  }) as unknown as HTMLElement;

const grid = [card(0, 0), card(1, 0), card(2, 0), card(0, 1), card(1, 1)];

test("j and k walk the cards in page order and stop at the ends", () => {
  assert.equal(nextCard(grid, null, "next"), grid[0], "the first key lands on the first card");
  assert.equal(nextCard(grid, grid[2], "next"), grid[3]);
  assert.equal(nextCard(grid, grid[4], "next"), grid[4]);
  assert.equal(nextCard(grid, grid[0], "prev"), grid[0]);
  assert.equal(nextCard([], null, "next"), null);
});

test("down and up keep to the column, or the nearest card in the next row", () => {
  assert.equal(nextCard(grid, grid[1], "down"), grid[4]);
  assert.equal(nextCard(grid, grid[2], "down"), grid[4], "no card below: the nearest in the row");
  assert.equal(nextCard(grid, grid[3], "up"), grid[0]);
  assert.equal(nextCard(grid, grid[0], "up"), grid[0], "the top row stays put");
});
