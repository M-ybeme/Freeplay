/** Ball colours: the classic set, pushed toward neon to sit on the UV felt. */
export const BALL_COLORS: Record<number, string> = {
  1: "#ffd21f",
  2: "#2f7bff",
  3: "#ff3b4e",
  4: "#a24dff",
  5: "#ff8a1f",
  6: "#3ddc6a",
  7: "#c2185b",
  8: "#15121f",
};

export function ballColor(id: number): string {
  if (id === 0) return "#f4f1ff";
  return BALL_COLORS[id > 8 ? id - 8 : id];
}

export const isStripe = (id: number) => id > 8;
