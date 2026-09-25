// 统计计算自检：node --test tests/stats.test.mjs
// 直接加载 src/js/core.js 中的统计函数，核对课件各例题用到的数值。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const win = {};
const ctx = vm.createContext({ window: win, console });
vm.runInContext(readFileSync(new URL('../src/js/core.js', import.meta.url), 'utf8'), ctx);
const st = win.M.stats;
const near = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

const JIA = [8, 7, 8, 9, 8, 6, 8, 10, 7, 8, 9, 8];
const DING = [10, 6, 8, 10, 6, 7, 10, 6, 9, 10, 8, 6];

test('众数与算术平均数（6.1 第1课时）', () => {
  assert.equal(st.mean(JIA), 8);
  assert.deepEqual([...st.modes(JIA).values], [8]);
  assert.deepEqual([...st.modes(DING).values], [6, 10]);
});

test('离差平方和、方差与标准差（6.1 第3课时）', () => {
  assert.equal(st.ss(JIA), 12);
  assert.equal(st.variance(JIA), 1);
  near(st.variance(DING), 34 / 12);
  near(st.sd(DING), 1.6833);
});

test('中位数（6.2 第1课时）', () => {
  const data = [2, 3, 3, 3, 4, 5, 6, 7, 12];
  assert.equal(st.median(data), 4);
  assert.equal(st.mean(data), 5);
  assert.equal(st.median([1.52, 1.55, 1.58, 1.6, 1.63, 1.66, 1.7, 1.72]), 1.615);
});

test('百分位数：n·p% 为整数时取相邻两项的平均数', () => {
  const H = [148, 151, 153, 154, 156, 157, 158, 159, 160, 160, 161, 162, 163, 164, 165, 167, 168, 170, 172, 176];
  assert.equal(st.percentile(H, 25), 156.5);
  assert.equal(st.percentile(H, 50), st.median(H));
  assert.equal(st.percentile(H, 90), 170 / 2 + 172 / 2);
  assert.equal(st.percentile([1, 2, 3, 4, 5, 6, 7], 30), 3);
});

test('四分位数（教材算法：n 为奇数时两半都不含中位数）', () => {
  const temps = st.quartiles([3, 1, 0, -2, 4, 5, 2, 2, -1, 3, 6, 2, 0, 1, 4, 7]);
  assert.deepEqual([temps.q1, temps.q2, temps.q3], [0.5, 2, 4]);
  const pull = st.quartiles([3, 8, 5, 12, 6, 9, 4, 7, 10, 6, 2]);
  assert.deepEqual([pull.q1, pull.q2, pull.q3], [4, 6, 9]);
  const rope = st.quartiles([141, 128, 152, 135, 160, 118, 143, 136, 149, 131, 178, 145, 138, 125, 156, 133, 142, 165, 140, 147]);
  assert.deepEqual([rope.min, rope.q1, rope.q2, rope.q3, rope.max], [118, 134, 141.5, 150.5, 178]);
});

test('加权平均数（6.1 第2课时）', () => {
  near(st.wmean([30, 20, 60], [2, 3, 1]), 30);
});

test('哪个团队收益大（6.3）', () => {
  const A = [5.21, 3.46, 6.72, 4.83, 1.89, 3.95, 2.74, 4.60, 3.12, 1.65, 4.38, 3.87];
  const B = [3.52, 3.95, 4.08, 3.71, 3.64, 3.83, 4.26, 3.98, 4.12, 4.35, 3.79, 3.88];
  near(st.mean(A), 3.8683); near(st.variance(A), 1.8746);
  near(st.mean(B), 3.9258); near(st.variance(B), 0.0566);
  const J = [15, 13, 14, 16, 14, 13, 15, 14], Y = [12, 18, 11, 20, 13, 17, 12, 19];
  assert.equal(st.mean(J), 14.25); assert.equal(st.mean(Y), 15.25);
  near(st.variance(J), 0.9375); near(st.variance(Y), 11.4375);
});

test('第七章：n² − n + 11 在 n = 11 时不是质数', () => {
  for (let n = 0; n <= 10; n++) assert.ok(st.isPrime(n * n - n + 11), `n = ${n}`);
  assert.equal(st.isPrime(121), false);
  assert.deepEqual([...st.factor(121)], [11, 11]);
});
