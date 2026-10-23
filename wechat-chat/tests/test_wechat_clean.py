"""运行：python3 -m unittest discover -s wechat-chat/tests"""

import csv
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from datetime import datetime, timedelta, timezone
from io import StringIO
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import wechat_clean as wc  # noqa: E402

SAMPLES = HERE.parent / "samples"
CST = timezone(timedelta(hours=8))


def load(name, **kw):
    opts = dict(fmt="auto", tz=CST, overrides={}, chat=None, me_label="小明")
    opts.update(kw)
    return wc.load_file(SAMPLES / name, **opts)


def run_cli(*argv):
    with redirect_stderr(StringIO()) as err:
        code = wc.run([str(a) for a in argv])
    return code, err.getvalue()


class ParseTimeTest(unittest.TestCase):
    def test_formats(self):
        expect = datetime(2024, 1, 5, 9, 3, 7)
        for text in ("2024-01-05 09:03:07", "2024/1/5 9:03:07", "2024.01.05 09:03:07",
                     "2024年1月5日 9:03:07", "2024-01-05T09:03:07", "2024-01-05T01:03:07Z",
                     "2024-01-05T01:03:07.123+00:00", 1704416587, "1704416587", 1704416587000):
            with self.subTest(text=text):
                self.assertEqual(wc.parse_time(text, CST), expect)

    def test_twelve_hour_clock(self):
        self.assertEqual(wc.parse_time("2024年1月5日 下午3:04", CST), datetime(2024, 1, 5, 15, 4))
        self.assertEqual(wc.parse_time("2024年1月5日 中午12:10", CST), datetime(2024, 1, 5, 12, 10))
        self.assertEqual(wc.parse_time("2024年1月5日 凌晨12:30", CST), datetime(2024, 1, 5, 0, 30))
        self.assertEqual(wc.parse_time("2024年1月5日 上午9:00", CST), datetime(2024, 1, 5, 9, 0))

    def test_rejects_garbage(self):
        for value in (None, "", "昨天", "2024-13-40 10:00", 42, True):
            with self.subTest(value=value):
                self.assertIsNone(wc.parse_time(value, CST))

    def test_utc_offset(self):
        self.assertEqual(wc.parse_time(1704416587, timezone.utc), datetime(2024, 1, 5, 1, 3, 7))


class ClassifyTest(unittest.TestCase):
    def test_codes_and_names(self):
        self.assertEqual(wc.classify(3, "<img/>", "a"), "图片")
        self.assertEqual(wc.classify("34", "", "a"), "语音")
        self.assertEqual(wc.classify("image", "", "a"), "图片")
        self.assertEqual(wc.classify("99999", "x", "a"), "类型99999")
        self.assertEqual(wc.classify("自定义", "x", "a"), "自定义")

    def test_content_placeholders(self):
        self.assertEqual(wc.classify(None, "[图片]", "a"), "图片")
        self.assertEqual(wc.classify(None, "[动画表情]", "a"), "表情")
        self.assertEqual(wc.classify(1, "[语音]3\"", "a"), "语音")
        self.assertEqual(wc.classify(None, "[语音 0:04]", "a"), "语音")
        self.assertEqual(wc.classify(None, "[文件: 体检报告.pdf]", "a"), "文件")
        self.assertEqual(wc.classify(None, "[位置] 西湖 (30.25,120.15)", "a"), "位置")
        self.assertEqual(wc.classify(None, "[视频/语音通话]", "a"), "通话")
        self.assertEqual(wc.classify(None, "[Photo]", "a"), "图片")
        self.assertEqual(wc.classify(None, "微信转账 转账 ¥20.00", "a"), "转账")
        # 文字里夹带的微信表情代码仍然是文本
        self.assertEqual(wc.classify(None, "[微笑]好的", "a"), "文本")

    def test_system_like(self):
        self.assertEqual(wc.classify(None, "小红撤回了一条消息", "小红"), "撤回")
        self.assertEqual(wc.classify(10000, "你撤回了一条消息", "x"), "撤回")
        self.assertEqual(wc.classify(None, '"小明" 拍了拍 "小红"', "小明"), "拍一拍")
        self.assertEqual(wc.classify(None, "你已添加了小红，现在可以开始聊天了。", "x"), "系统")
        self.assertEqual(wc.classify(None, "任意内容", "系统消息"), "系统")

    def test_ordinary_sentences_stay_text(self):
        for text in ("我拍了拍他的肩膀，说加油", "你撤回了一条消息干嘛", "图片发你了"):
            with self.subTest(text=text):
                self.assertEqual(wc.classify(None, text, "a"), "文本")


class TxtLayoutTest(unittest.TestCase):
    def test_time_first_multiline(self):
        messages, source = load("示例-时间在前.txt")
        self.assertEqual(source.layout, "时间 名字 / 下一行内容")
        self.assertEqual(source.skipped, 2)  # 标题和分隔线
        self.assertEqual(len(messages), 7)
        self.assertEqual(messages[1].content, "去，晚上七点\n练腿日")
        self.assertEqual([m.type for m in messages],
                         ["文本", "文本", "表情", "图片", "拍一拍", "撤回", "文本"])

    def test_name_first_keeps_same_minute_repeats(self):
        messages, source = load("示例-名字在前.txt")
        self.assertEqual(source.layout, "名字 时间 / 下一行内容")
        self.assertEqual(len(messages), 5)
        self.assertEqual(sum(m.type == "图片" for m in messages), 2)
        self.assertEqual(messages[-1].time, datetime(2024, 3, 2, 15, 4))

    def test_inline_with_continuation(self):
        messages, source = load("示例-单行.txt")
        self.assertEqual(source.layout, "[时间] 名字: 内容")
        self.assertEqual([m.sender for m in messages], ["小红", "小明", "小红"])
        self.assertEqual(messages[1].content, "鸡胸肉 + 西兰花\n还有一碗米饭")

    def test_inline_without_brackets_and_colon_in_content(self):
        text = "2024-01-05 09:03:07 小红：几点？\n2024-01-05 09:04:00 小明: 19:30 老地方\n"
        parsed = wc.parse_txt(text, CST)
        rows = parsed["rows"]
        self.assertEqual(parsed["layout"], "时间 名字: 内容")
        self.assertEqual(rows[1]["sender"], "小明")
        self.assertEqual(rows[1]["content"], "19:30 老地方")

    def test_unrecognised_text(self):
        with self.assertRaises(wc.ParseError):
            wc.parse_txt("只是一些普通文字\n没有时间\n", CST)

    def test_gbk_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "gbk.txt"
            path.write_bytes("2024-03-01 08:15:02 小红\n早呀\n".encode("gbk"))
            messages, source = wc.load_file(path, "auto", CST, {}, None, "我")
        self.assertEqual(source.encoding, "gb18030")
        self.assertEqual((messages[0].sender, messages[0].content), ("小红", "早呀"))


class WechatExporterTest(unittest.TestCase):
    """WechatExporter（读取 iPhone 备份）的文本导出：名字 (时间):内容"""

    def test_sample(self):
        messages, source = load("iPhone导出/小明/小红/index.txt")
        self.assertEqual(source.layout, "名字 (时间):内容")
        self.assertEqual(source.skipped, 0)  # 首行“小红 - 微信聊天记录”是会话标题
        self.assertTrue(all(m.conversation == "小红" for m in messages))
        self.assertEqual([(m.sender, m.type) for m in messages], [
            ("小红", "文本"), ("小明", "文本"), ("小红", "图片"), ("系统", "撤回"),
            ("小明", "文本"), ("系统", "拍一拍"), ("小红", "语音"), ("小明", "聊天记录"),
            ("小红", "转账"), ("小明", "文本"), ("小红", "表情"),
        ])
        self.assertEqual(messages[1].content, "七点\n老地方见")
        # 系统提示没有时间，沿用上一条
        self.assertEqual(messages[3].time, messages[2].time)
        # 引用回复拆成回复内容和引用
        self.assertEqual((messages[4].content, messages[4].quote), ("七点，别迟到", "小红：今天几点去？"))
        self.assertEqual(messages[5].content, '"小明" 拍了拍 "小红"')
        # 转发记录里的消息并入转发的那条，不算这个会话的消息
        self.assertNotIn("阿杰", {m.sender for m in messages})
        self.assertIn("阿杰 (2024-03-04 20:00:00):周末爬山", messages[7].content)
        # 转账后面粘在同一行的下一条消息被拆开
        self.assertEqual(messages[8].content, "微信转账 转账 ¥20.00")
        self.assertEqual((messages[9].sender, messages[9].content), ("小明", "收到啦"))

    def test_nested_forward(self):
        text = ("A (2024-03-05 08:00:00):记录\n<< 外层\nB (2024-03-01 08:00:00):记录\n<< 内层\n"
                "C (2024-03-01 07:00:00):嗨\n内层 结束 >>\n外层 结束 >>\nA (2024-03-05 08:01:00):看看\n")
        parsed = wc.parse_txt(text, CST)
        self.assertEqual([r["sender"] for r in parsed["rows"]], ["A", "A"])
        self.assertEqual(parsed["rows"][0]["type"], "聊天记录")

    def test_multiline_message_is_not_mistaken_for_notice(self):
        text = "A (2024-03-05 08:00:00):第一行\n第二行\nB (2024-03-05 08:01:00):好\n"
        rows = wc.parse_txt(text, CST)["rows"]
        self.assertEqual(rows[0]["content"], "第一行\n第二行")

    def test_self_hint_across_conversations(self):
        t = datetime(2024, 3, 1)
        messages = [wc.Message(t, "小明", "a", conversation="小红"), wc.Message(t, "小红", "b", conversation="小红"),
                    wc.Message(t, "小明", "c", conversation="阿杰"), wc.Message(t, "阿杰", "d", conversation="阿杰")]
        self.assertIn('--me "小明"', wc.guess_self_hint(messages))
        self.assertEqual(wc.guess_self_hint(messages[:2]), "")


class TableTest(unittest.TestCase):
    def test_csv_columns_and_self(self):
        messages, source = load("示例-表格.csv")
        self.assertEqual(source.columns["时间"], "StrTime / CreateTime")
        self.assertEqual(len(messages), 6)
        self.assertEqual([m.sender for m in messages], ["小红", "小明", "小明", "小红", "系统", "小红"])
        self.assertEqual([m.type for m in messages], ["文本", "文本", "图片", "语音", "撤回", "文本"])
        self.assertEqual(messages[0].conversation, "wxid_xiaohong")

    def test_json_nested_and_timestamps(self):
        messages, source = load("示例-导出.json", chat="健身搭子群")
        self.assertEqual([m.time.strftime("%H:%M") for m in messages], ["12:00", "12:01", "12:02", "12:03"])
        self.assertEqual(messages[1].content, "@阿杰 好啊")  # U+2005 已换成普通空格
        self.assertEqual(messages[2].type, "位置")
        self.assertEqual(messages[3].sender, "系统")
        self.assertTrue(all(m.conversation == "健身搭子群" for m in messages))

    def test_column_override_and_split_date_time(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "split.csv"
            path.write_text("日期,时间,说话的人,话\n2024-03-01,08:15:02,小红,早\n", encoding="utf-8")
            with self.assertRaises(wc.ParseError):  # “说话的人”“话”都不在别名表里
                wc.load_file(path, "auto", CST, {}, None, "我")
            messages, _ = wc.load_file(path, "auto", CST, {"sender": "说话的人", "content": "话"}, None, "我")
        self.assertEqual(messages[0].time, datetime(2024, 3, 1, 8, 15, 2))
        self.assertEqual(messages[0].sender, "小红")

    def test_missing_override_column(self):
        with self.assertRaisesRegex(wc.ParseError, "--col-self"):
            wc.resolve_columns(["time", "content"], {"is_self": "IsMe"})


class CleaningTest(unittest.TestCase):
    def msg(self, minute, content, sender="小红", kind="文本"):
        return wc.Message(datetime(2024, 3, 1, 8, minute), sender, content, kind)

    def test_merge_removes_overlap_between_files_only(self):
        a = [self.msg(1, "[图片]", kind="图片"), self.msg(1, "[图片]", kind="图片"), self.msg(2, "早")]
        b = [self.msg(1, "[图片]", kind="图片"), self.msg(2, "早"), self.msg(3, "新消息")]
        merged, removed = wc.merge([a, b])
        self.assertEqual(removed, 2)
        self.assertEqual([m.content for m in merged], ["[图片]", "[图片]", "早", "新消息"])

    def test_filters(self):
        messages = [self.msg(1, "早"), self.msg(2, "小红撤回了一条消息", kind="撤回"),
                    self.msg(3, "[图片]", kind="图片")]
        kept, n = wc.apply_filters(messages, None, None, drop_system=True, text_only=False)
        self.assertEqual((len(kept), n), (2, 1))
        kept, n = wc.apply_filters(messages, None, None, drop_system=False, text_only=True)
        self.assertEqual((len(kept), n), (1, 2))
        later = wc.parse_day("2024-03-02")
        self.assertEqual(wc.apply_filters(messages, later, None, False, False)[1], 3)

    def test_anonymize(self):
        messages = [self.msg(1, "张三丰你好", sender="小红"), self.msg(2, "@小红 在吗", sender="张三丰"),
                    self.msg(3, "好的", sender="小明")]
        messages[2].is_self = True
        for m in messages:
            m.conversation = "小红"
        name_map = wc.anonymize(messages)
        self.assertEqual([m.sender for m in messages], ["成员01", "成员02", "我"])
        self.assertEqual(messages[0].content, "成员02你好")
        self.assertEqual(messages[1].content, "@成员01 在吗")
        self.assertEqual(messages[0].conversation, "成员01")  # 单聊的会话名就是对方的名字
        self.assertIn({"原名": "张三丰", "代号": "成员02", "类别": "发送人"}, name_map)

    def test_mask_pii(self):
        m = self.msg(1, "电话13800138000，身份证11010519491231002X，卡号6222020200112233445，"
                        "邮箱 test.user@example.com，订单 12345")
        self.assertEqual(wc.mask_pii([m]), 4)
        self.assertEqual(m.content, "电话[手机号]，身份证[身份证号]，卡号[卡号]，邮箱 [邮箱]，订单 12345")


class EndToEndTest(unittest.TestCase):
    def test_all_samples(self):
        with tempfile.TemporaryDirectory() as tmp:
            code, log = run_cli(SAMPLES, "--me", "小明", "-o", tmp)
            self.assertEqual(code, 0, log)
            out = Path(tmp)
            raw = (out / "messages.csv").read_bytes()
            self.assertTrue(raw.startswith(b"\xef\xbb\xbf"))  # Excel 需要的 BOM
            with (out / "messages.csv").open(encoding="utf-8-sig", newline="") as f:
                rows = list(csv.DictReader(f))
            summary = json.loads((out / "summary.json").read_text(encoding="utf-8"))
            jsonl = [json.loads(line) for line in (out / "messages.jsonl").read_text(encoding="utf-8").splitlines()]
            chat = (out / "chat.txt").read_text(encoding="utf-8")

        self.assertEqual(len(rows), 36)
        self.assertEqual(len(jsonl), 36)
        self.assertEqual(summary["counts"]["messages"], 36)
        self.assertEqual(rows, sorted(rows, key=lambda r: r["datetime"]))
        self.assertEqual({r["is_self"] for r in rows}, {"0", "1"})
        # 会话列表文件 index.txt 不含消息，跳过但不中止
        self.assertEqual(summary["notes"], ["跳过了 1 个无法识别的文件：小明/index.txt"])
        self.assertIn("跳过 ", log)
        self.assertIn("08:16 小明：去，晚上七点\n      练腿日", chat)
        self.assertIn("08:02 小明：[图片]", chat)  # XML 内容在可读文本里显示为占位符

    def test_overlapping_exports_and_privacy_flags(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp)
            (src / "a.txt").write_text("2024-03-01 08:00:00 小红\n早\n2024-03-01 08:01:00 小明\n13800138000\n",
                                       encoding="utf-8")
            (src / "b.txt").write_text("2024-03-01 08:01:00 小明\n13800138000\n2024-03-01 09:00:00 小红\n好\n",
                                       encoding="utf-8")
            out = src / "out"
            code, log = run_cli(src / "a.txt", src / "b.txt", "--chat", "小红", "--me", "小明",
                                "--anonymize", "--mask-pii", "-o", out)
            self.assertEqual(code, 0, log)
            summary = json.loads((out / "summary.json").read_text(encoding="utf-8"))
            text = (out / "messages.csv").read_text(encoding="utf-8-sig")
            self.assertTrue((out / "name_map.csv").exists())

            # 再跑一次不带 --anonymize，旧的对照表应被删掉
            code, _ = run_cli(src / "a.txt", "-o", out)
            self.assertEqual(code, 0)
            self.assertFalse((out / "name_map.csv").exists())

        self.assertEqual(summary["counts"]["duplicates_removed"], 1)
        self.assertEqual(summary["counts"]["messages"], 3)
        self.assertEqual(summary["counts"]["pii_masked"], 1)
        self.assertNotIn("小红", text)
        self.assertNotIn("13800138000", text)

    def test_notes_when_self_unknown(self):
        with tempfile.TemporaryDirectory() as tmp:
            code, log = run_cli(SAMPLES / "示例-单行.txt", "-o", tmp)
            summary = json.loads((Path(tmp) / "summary.json").read_text(encoding="utf-8"))
        self.assertEqual(code, 0)
        self.assertTrue(any("无法判断" in n for n in summary["notes"]))
        self.assertIn("注意：", log)

    def test_directory_input_skips_output_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp)
            (src / "a.txt").write_text("2024-03-01 08:00:00 小红\n早\n", encoding="utf-8")
            for _ in range(2):  # 第二次运行时 output/ 里已有上次的 messages.csv
                code, log = run_cli(src, "-o", src / "output")
                self.assertEqual(code, 0, log)
            summary = json.loads((src / "output" / "summary.json").read_text(encoding="utf-8"))
        self.assertEqual(len(summary["sources"]), 1)
        self.assertEqual(summary["counts"]["messages"], 1)

    def test_unreadable_explicit_file_is_an_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "list.txt"
            path.write_text("只是一些普通文字\n", encoding="utf-8")
            code, log = run_cli(path, "-o", Path(tmp) / "out")
        self.assertEqual(code, 1)
        self.assertIn("没有找到能识别的消息抬头行", log)

    def test_bad_input_returns_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            code, log = run_cli(Path(tmp) / "不存在.txt", "-o", tmp)
        self.assertEqual(code, 1)
        self.assertIn("找不到输入文件", log)


if __name__ == "__main__":
    unittest.main()
