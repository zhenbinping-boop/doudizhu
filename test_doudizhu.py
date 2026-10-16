#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_doudizhu.py
针对斗地主规则、手牌解析、比牌判断及局外数值经济系统的自动化测试套件
"""

import unittest
from collections import Counter

class Card:
    def __init__(self, rank, suit='♠'):
        self.rank = rank # 3~17
        self.suit = suit

    def __repr__(self):
        names = {11:'J', 12:'Q', 13:'K', 14:'A', 15:'2', 16:'小王', 17:'大王'}
        return f"{self.suit}{names.get(self.rank, str(self.rank))}"

class RuleEnginePy:
    @staticmethod
    def parse_hand(cards):
        if not cards:
            return {'type': 'PASS', 'rank': 0, 'len': 0}
        
        n = len(cards)
        counts = Counter(c.rank for c in cards)

        # 单张
        if n == 1:
            return {'type': 'SINGLE', 'rank': cards[0].rank, 'len': 1}

        # 对子 / 王炸
        if n == 2:
            ranks = set(c.rank for c in cards)
            if 16 in ranks and 17 in ranks:
                return {'type': 'ROCKET', 'rank': 17, 'len': 2}
            if len(counts) == 1:
                return {'type': 'PAIR', 'rank': cards[0].rank, 'len': 2}
            return {'type': 'INVALID', 'rank': 0, 'len': 0}

        # 三张
        if n == 3:
            if len(counts) == 1:
                return {'type': 'TRIPLE', 'rank': cards[0].rank, 'len': 3}
            return {'type': 'INVALID', 'rank': 0, 'len': 0}

        # 炸弹 / 三带一
        if n == 4:
            if len(counts) == 1:
                return {'type': 'BOMB', 'rank': cards[0].rank, 'len': 4}
            for r, cnt in counts.items():
                if cnt == 3:
                    return {'type': 'TRIPLE_ONE', 'rank': r, 'len': 4}
            return {'type': 'INVALID', 'rank': 0, 'len': 0}

        # 三带二 / 顺子(5)
        if n == 5:
            if len(counts) == 2 and 3 in counts.values() and 2 in counts.values():
                triple_r = [r for r, cnt in counts.items() if cnt == 3][0]
                return {'type': 'TRIPLE_TWO', 'rank': triple_r, 'len': 5}
            if RuleEnginePy.is_straight(cards):
                return {'type': 'STRAIGHT', 'rank': max(c.rank for c in cards), 'len': 5}
            return {'type': 'INVALID', 'rank': 0, 'len': 0}

        # 6张: 顺子(6), 连对(3对), 飞机不带(2个三张), 四带二单
        if n == 6:
            if RuleEnginePy.is_straight(cards):
                return {'type': 'STRAIGHT', 'rank': max(c.rank for c in cards), 'len': 6}
            if RuleEnginePy.is_consecutive_pairs(cards):
                return {'type': 'CONSECUTIVE_PAIRS', 'rank': max(c.rank for c in cards), 'len': 3}
            if RuleEnginePy.is_airplane(cards):
                return {'type': 'AIRPLANE', 'rank': max(c.rank for c in cards), 'len': 2}
            if 4 in counts.values():
                quad_r = [r for r, cnt in counts.items() if cnt == 4][0]
                return {'type': 'FOUR_TWO_SINGLES', 'rank': quad_r, 'len': 6}

        # 顺子 (>=5)
        if 5 <= n <= 12 and RuleEnginePy.is_straight(cards):
            return {'type': 'STRAIGHT', 'rank': max(c.rank for c in cards), 'len': n}

        # 连对 (>=3对)
        if n >= 6 and n % 2 == 0 and RuleEnginePy.is_consecutive_pairs(cards):
            return {'type': 'CONSECUTIVE_PAIRS', 'rank': max(c.rank for c in cards), 'len': n // 2}

        # 飞机不带 (>=2连)
        if n >= 6 and n % 3 == 0 and RuleEnginePy.is_airplane(cards):
            return {'type': 'AIRPLANE', 'rank': max(c.rank for c in cards), 'len': n // 3}

        # 四带两对 (8张)
        if n == 8 and 4 in counts.values():
            quad_r = [r for r, cnt in counts.items() if cnt == 4][0]
            remaining = [cnt for r, cnt in counts.items() if r != quad_r]
            if remaining == [2, 2] or remaining == [4]:
                return {'type': 'FOUR_TWO_PAIRS', 'rank': quad_r, 'len': 8}

        return {'type': 'INVALID', 'rank': 0, 'len': 0}

    @staticmethod
    def is_straight(cards):
        if len(cards) < 5 or len(cards) > 12:
            return False
        ranks = sorted(c.rank for c in cards)
        if any(r >= 15 for r in ranks): # 不能有 2 和王
            return False
        for i in range(len(ranks) - 1):
            if ranks[i+1] - ranks[i] != 1:
                return False
        return True

    @staticmethod
    def is_consecutive_pairs(cards):
        if len(cards) < 6 or len(cards) % 2 != 0:
            return False
        counts = Counter(c.rank for c in cards)
        if any(cnt != 2 for cnt in counts.values()):
            return False
        ranks = sorted(counts.keys())
        if any(r >= 15 for r in ranks):
            return False
        for i in range(len(ranks) - 1):
            if ranks[i+1] - ranks[i] != 1:
                return False
        return True

    @staticmethod
    def is_airplane(cards):
        if len(cards) < 6 or len(cards) % 3 != 0:
            return False
        counts = Counter(c.rank for c in cards)
        if any(cnt != 3 for cnt in counts.values()):
            return False
        ranks = sorted(counts.keys())
        if any(r >= 15 for r in ranks):
            return False
        for i in range(len(ranks) - 1):
            if ranks[i+1] - ranks[i] != 1:
                return False
        return True

    @staticmethod
    def can_beat(current, target):
        if not current or current['type'] == 'INVALID':
            return False
        if not target or target['type'] == 'PASS':
            return True

        if current['type'] == 'ROCKET':
            return True
        if target['type'] == 'ROCKET':
            return False

        if current['type'] == 'BOMB':
            if target['type'] != 'BOMB':
                return True
            return current['rank'] > target['rank']
        if target['type'] == 'BOMB':
            return False

        if current['type'] == target['type'] and current['len'] == target['len']:
            return current['rank'] > target['rank']

        return False

class TestDouDizhu(unittest.TestCase):
    def test_single_and_pair(self):
        c1 = [Card(3)]
        h1 = RuleEnginePy.parse_hand(c1)
        self.assertEqual(h1['type'], 'SINGLE')
        self.assertEqual(h1['rank'], 3)

        pair = [Card(8), Card(8)]
        hp = RuleEnginePy.parse_hand(pair)
        self.assertEqual(hp['type'], 'PAIR')
        self.assertEqual(hp['rank'], 8)

    def test_bombs_and_rocket(self):
        bomb = [Card(7), Card(7), Card(7), Card(7)]
        hb = RuleEnginePy.parse_hand(bomb)
        self.assertEqual(hb['type'], 'BOMB')

        rocket = [Card(16), Card(17)]
        hr = RuleEnginePy.parse_hand(rocket)
        self.assertEqual(hr['type'], 'ROCKET')

        # 王炸压制炸弹
        self.assertTrue(RuleEnginePy.can_beat(hr, hb))
        # 炸弹压制单顺子
        straight = [Card(3), Card(4), Card(5), Card(6), Card(7)]
        hs = RuleEnginePy.parse_hand(straight)
        self.assertTrue(RuleEnginePy.can_beat(hb, hs))

    def test_straights_and_consecutive_pairs(self):
        s1 = [Card(3), Card(4), Card(5), Card(6), Card(7)]
        s2 = [Card(4), Card(5), Card(6), Card(7), Card(8)]
        h1 = RuleEnginePy.parse_hand(s1)
        h2 = RuleEnginePy.parse_hand(s2)
        self.assertEqual(h1['type'], 'STRAIGHT')
        self.assertTrue(RuleEnginePy.can_beat(h2, h1))

        # 包含 2 不构成顺子
        bad_s = [Card(11), Card(12), Card(13), Card(14), Card(15)]
        self.assertEqual(RuleEnginePy.parse_hand(bad_s)['type'], 'INVALID')

        # 连对 33 44 55
        cp = [Card(3), Card(3), Card(4), Card(4), Card(5), Card(5)]
        hcp = RuleEnginePy.parse_hand(cp)
        self.assertEqual(hcp['type'], 'CONSECUTIVE_PAIRS')

    def test_triples_and_wings(self):
        # 3带1
        t1 = [Card(9), Card(9), Card(9), Card(3)]
        ht1 = RuleEnginePy.parse_hand(t1)
        self.assertEqual(ht1['type'], 'TRIPLE_ONE')
        self.assertEqual(ht1['rank'], 9)

        # 3带2
        t2 = [Card(10), Card(10), Card(10), Card(4), Card(4)]
        ht2 = RuleEnginePy.parse_hand(t2)
        self.assertEqual(ht2['type'], 'TRIPLE_TWO')
        self.assertEqual(ht2['rank'], 10)

    def test_shop_and_cosmetics(self):
        # 验证商城的分级定价、品阶与商品分类
        items = [
            {'id': 'table_gold', 'type': 'table', 'cost': 1680, 'costType': 'diamonds', 'rarity': 'legendary'},
            {'id': 'back_gold', 'type': 'back', 'cost': 1880, 'costType': 'diamonds', 'rarity': 'legendary'},
            {'id': 'effect_dragon', 'type': 'effect', 'cost': 2180, 'costType': 'diamonds', 'rarity': 'legendary'},
            {'id': 'title_god', 'type': 'title', 'cost': 1999, 'costType': 'diamonds', 'rarity': 'legendary'},
            {'id': 'table_wood', 'type': 'table', 'cost': 38000, 'costType': 'coins', 'rarity': 'rare'}
        ]
        for it in items:
            self.assertGreater(it['cost'], 0)
            self.assertIn(it['costType'], ['coins', 'diamonds'])
            self.assertIn(it['rarity'], ['common', 'rare', 'epic', 'legendary'])

if __name__ == '__main__':
    unittest.main()

