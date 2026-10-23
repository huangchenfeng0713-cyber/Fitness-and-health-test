#!/usr/bin/env python3
"""微信聊天记录整理：把导出的 TXT / CSV / JSON 清洗成统一结构，方便后续分析。

只依赖 Python 3.8+ 标准库，不联网，数据全程只在本机处理。用法见同目录 README.md：

    python3 wechat_clean.py data/张三.txt --me 我的昵称
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

HERE = Path(__file__).resolve().parent
WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
SUPPORTED_SUFFIXES = {".txt", ".text", ".log", ".csv", ".tsv", ".json", ".jsonl"}

# ---------------------------------------------------------------- 时间

PERIODS = "凌晨|早上|上午|中午|下午|傍晚|晚上"
# 在文本行里定位时间戳用的片段：不含捕获组，便于嵌进各种行格式
TS = (
    r"\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s*|T)"
    r"(?:(?:" + PERIODS + r")\s*)?\d{1,2}[:：]\d{2}(?:[:：]\d{2})?"
)
TIME_PARTS = re.compile(
    r"^\s*(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:\s*|T)"
    r"(?:(" + PERIODS + r")\s*)?(\d{1,2})[:：](\d{2})(?:[:：](\d{2}))?(?:[.,]\d+)?"
    r"\s*(Z|[+-]\d{2}:?\d{2})?\s*$"
)


def parse_offset(text: str) -> timezone:
    sign = -1 if text.startswith("-") else 1
    digits = text[1:].replace(":", "")
    return timezone(sign * timedelta(hours=int(digits[:2]), minutes=int(digits[2:] or 0)))


def from_epoch(ts: float, tz: timezone) -> Optional[datetime]:
    if ts > 1e11:  # 毫秒
        ts /= 1000
    if ts < 1e8:  # 早于 1973 年，多半是把别的数字列当成了时间
        return None
    try:
        return datetime.fromtimestamp(ts, tz).replace(tzinfo=None)
    except (OverflowError, OSError, ValueError):
        return None


def parse_time(value, tz: timezone) -> Optional[datetime]:
    """把各种写法的时间统一成 tz 时区下的 naive datetime；无法识别时返回 None。

    支持 Unix 秒/毫秒、2024-01-05 09:03:07、2024/1/5 9:03、2024年1月5日 下午3:04、
    带 Z 或 +08:00 的 ISO 时间。不带时区的字符串视为已经是 tz 时区的本地时间。
    """
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return from_epoch(float(value), tz)
    text = str(value).strip()
    if not text:
        return None
    if re.fullmatch(r"\d+(?:\.\d+)?", text):
        return from_epoch(float(text), tz)
    m = TIME_PARTS.match(text)
    if not m:
        return None
    year, month, day, period, hour, minute, second, offset = m.groups()
    hour = int(hour)
    if period in ("下午", "傍晚", "晚上") and hour < 12:
        hour += 12
    elif period == "中午" and hour < 11:
        hour += 12
    elif period in ("凌晨", "早上", "上午") and hour == 12:
        hour = 0
    try:
        dt = datetime(int(year), int(month), int(day), hour, int(minute), int(second or 0))
    except ValueError:
        return None
    if offset:
        source_tz = timezone.utc if offset == "Z" else parse_offset(offset)
        dt = dt.replace(tzinfo=source_tz).astimezone(tz).replace(tzinfo=None)
    return dt


def parse_day(text: str) -> date:
    m = re.fullmatch(r"\s*(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?\s*", text)
    if not m:
        raise argparse.ArgumentTypeError(f"日期格式应为 YYYY-MM-DD：{text}")
    return date(*map(int, m.groups()))


# ---------------------------------------------------------------- 消息类型

# 微信本地数据库 MSG 表的 Type 字段（公开资料整理，不同版本可能有出入）
TYPE_CODES = {
    1: "文本", 3: "图片", 34: "语音", 42: "名片", 43: "视频", 47: "表情",
    48: "位置", 49: "分享", 50: "通话", 10000: "系统", 10002: "系统",
}
TYPE_NAMES = {
    "text": "文本", "文本": "文本", "文字": "文本", "txt": "文本",
    "image": "图片", "img": "图片", "picture": "图片", "photo": "图片", "图片": "图片",
    "voice": "语音", "audio": "语音", "语音": "语音",
    "video": "视频", "视频": "视频",
    "emoji": "表情", "emotion": "表情", "sticker": "表情", "表情": "表情", "动画表情": "表情",
    "file": "文件", "文件": "文件",
    "link": "链接", "url": "链接", "链接": "链接",
    "location": "位置", "位置": "位置",
    "card": "名片", "名片": "名片",
    "call": "通话", "通话": "通话", "语音通话": "通话", "视频通话": "通话",
    "system": "系统", "sys": "系统", "系统": "系统", "系统消息": "系统",
    "recall": "撤回", "撤回": "撤回", "撤回消息": "撤回",
    "pat": "拍一拍", "拍一拍": "拍一拍",
    "红包": "红包", "转账": "转账",
}
# 文本导出里，非文字消息以方括号占位符开头，如 [图片]、[语音 0:04]、[文件: a.pdf]、[位置] 地名。
# 按括号里的第一个词归类；[微笑] 这类微信表情代码不在表里，仍算文字
PLACEHOLDER_RE = re.compile(r"^\[([^\]\s:：]+)[^\]]*\]")
PLACEHOLDER_KINDS = {
    "图片": "图片", "照片": "图片", "Photo": "图片",
    "语音": "语音", "Audio": "语音",
    "视频": "视频", "Video": "视频",
    "动画表情": "表情", "表情": "表情", "Emoji": "表情",
    "文件": "文件", "File": "文件",
    "链接": "链接", "分享": "链接", "小程序": "链接", "音乐": "链接", "Link": "链接",
    "位置": "位置", "实时位置共享": "位置", "Location": "位置", "Real-time": "位置",
    "名片": "名片", "个人名片": "名片", "视频号名片": "名片", "Contact": "名片", "Channel": "名片",
    "红包": "红包", "微信红包": "红包", "Red": "红包",
    "转账": "转账", "Transfer": "转账",
    "语音通话": "通话", "视频通话": "通话", "视频/语音通话": "通话", "Video/Audio": "通话",
    "聊天记录": "聊天记录",
}
TEXT_PREFIX_KINDS = (("微信转账", "转账"), ("Weixin Transfer", "转账"))
SYSTEM_SENDERS = {"系统", "系统消息", "system", "sys"}
NOISE_TYPES = {"系统", "撤回", "拍一拍"}
RECALL_RE = re.compile(r"^.{0,40}撤回了一条消息(?:\s*重新编辑)?$")
PAT_RE = re.compile(r"^[^\n，。！？,!?]{1,40}?\s?拍了拍\s?[^\n，。！？,!?]{0,40}$")
SYSTEM_RE = re.compile(
    "加入了群聊|移出了群聊|退出了群聊|修改群名为|成为新群主|你已添加了|"
    "以上是打招呼的内容|现在可以开始聊天了|开启了朋友验证|但被对方拒收了"
)


def raw_kind(raw_type) -> Optional[str]:
    """原始类型字段（数字代码或名称）对应的类型；字段为空时返回 None。"""
    raw = "" if raw_type is None else str(raw_type).strip()
    if not raw:
        return None
    if re.fullmatch(r"\d+", raw):
        return TYPE_CODES.get(int(raw), f"类型{raw}")
    return TYPE_NAMES.get(raw.lower(), raw)


def classify(raw_type, content: str, sender: str) -> str:
    """结合原始类型字段和内容推断消息类型。原始类型缺失或为文本/系统时，用内容细分。"""
    base = raw_kind(raw_type)
    if base not in (None, "文本", "系统"):
        return base
    text = content.strip()
    if base != "系统":
        m = PLACEHOLDER_RE.match(text)
        if m and m.group(1) in PLACEHOLDER_KINDS:
            return PLACEHOLDER_KINDS[m.group(1)]
        for prefix, kind in TEXT_PREFIX_KINDS:
            if text.startswith(prefix):
                return kind
    short = len(text) <= 120 and "\n" not in text
    if short and RECALL_RE.match(text):
        return "撤回"
    if short and PAT_RE.match(text):
        return "拍一拍"
    if base == "系统" or sender.strip().lower() in SYSTEM_SENDERS:
        return "系统"
    if short and SYSTEM_RE.search(text):
        return "系统"
    return "文本"


# 微信在 @某人 后面插入的是 U+2005，另有零宽字符和 BOM 混在文本里
INVISIBLE = str.maketrans({"\u2005": " ", "\u2006": " ", "\u00a0": " ",
                           "\u200b": None, "\ufeff": None, "\r": None})


def clean_text(text: str) -> str:
    return text.translate(INVISIBLE).strip()


# ---------------------------------------------------------------- 数据结构

@dataclass
class Message:
    time: datetime
    sender: str
    content: str
    type: str = "文本"
    is_self: Optional[bool] = None
    conversation: str = ""
    quote: str = ""  # 引用回复时被引用的那条消息


@dataclass
class Source:
    """单个输入文件的解析情况，写进摘要供核对。"""
    path: str
    format: str
    layout: str = ""
    encoding: str = ""
    parsed: int = 0
    skipped: int = 0
    columns: Dict[str, str] = field(default_factory=dict)


class ParseError(Exception):
    pass


def read_text(path: Path) -> Tuple[str, str]:
    raw = path.read_bytes()
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        return raw.decode("utf-16"), "utf-16"
    try:
        return raw.decode("utf-8-sig"), "utf-8"
    except UnicodeDecodeError:
        # 电脑版工具导出的文件有时是 GBK
        return raw.decode("gb18030", errors="replace"), "gb18030"


# ---------------------------------------------------------------- TXT

NAME = r"(?P<name>.+?)"
TXT_LAYOUTS = (
    # (名称, 每条消息第一行的正则, 内容是否从下一行开始)
    ("[时间] 名字: 内容", re.compile(rf"^\[(?P<time>{TS})\]\s*{NAME}\s*[:：]\s?(?P<content>.*)$"), False),
    ("时间 名字: 内容", re.compile(rf"^(?P<time>{TS})\s+{NAME}\s*[:：]\s?(?P<content>.*)$"), False),
    ("名字 (时间):内容", re.compile(rf"^{NAME}\s*[(（](?P<time>{TS})[)）]\s*[:：]\s?(?P<content>.*)$"), False),
    ("时间 名字 / 下一行内容", re.compile(rf"^\[?(?P<time>{TS})\]?\s+{NAME}\s*$"), True),
    ("名字 时间 / 下一行内容", re.compile(rf"^{NAME}\s+[\[(（]?(?P<time>{TS})[\])）]?\s*$"), True),
)
TIME_FIRST_INLINE = (0, 1)
TIME_FIRST_HEADER = 3
# “名字 (时间):内容”是 WechatExporter（读取 iPhone 备份）的文本导出格式。它的系统提示单独占一行、
# 没有名字和时间；转发的聊天记录夹在“<< 标题”和“标题 结束 >>”之间；转账消息后面不换行
WECHAT_EXPORTER = 2
TITLE_RE = re.compile(r"^(.+?) - (?:微信聊天记录|WeChat Chat History)\s*$")
FORWARD_START_RE = re.compile(r"^<< .+$")
FORWARD_END_RE = re.compile(r"^.+ (?:结束|Ends) >>$")
SYSTEM_PREFIX_RE = re.compile(r"^(?:System Message:|系统消息[:：])\s*")
QUOTE_SEPARATOR = "\n- - - - - - - - - - - - - - -\n"


def detect_layout(lines: Sequence[str]) -> Optional[int]:
    sample = [line for line in lines[:50000] if line.strip()][:5000]
    counts = [sum(1 for line in sample if rx.match(line)) for _, rx, _ in TXT_LAYOUTS]
    best = max(range(len(counts)), key=lambda i: counts[i])
    if best == TIME_FIRST_HEADER:
        # 单行格式的每一行同样符合“时间 名字”抬头格式，两者条数接近时说明是单行格式
        inline = max(TIME_FIRST_INLINE, key=lambda i: counts[i])
        if counts[inline] >= 0.9 * counts[best]:
            best = inline
    return best if counts[best] else None


def is_notice(line: str) -> bool:
    text = line.strip()
    return bool(text) and (bool(SYSTEM_PREFIX_RE.match(text)) or classify(None, text, "") in NOISE_TYPES)


def split_glued_lines(lines: List[str], rx) -> List[str]:
    """转账消息末尾没有换行，下一条消息会接在同一行，按已知的发送人名字拆开。"""
    names = {m["name"].strip() for m in map(rx.match, lines) if m}
    if not names:
        return lines
    alternation = "|".join(map(re.escape, sorted(names, key=len, reverse=True)))
    glued = re.compile(rf"(?:{alternation})\s*[(（]{TS}[)）]\s*[:：]")
    out = []
    for line in lines:
        while True:
            m = rx.match(line)
            if not m or not m["content"].startswith(tuple(p for p, _ in TEXT_PREFIX_KINDS)):
                break
            hit = glued.search(line, m.start("content"))
            if not hit:
                break
            out.append(line[:hit.start()])
            line = line[hit.start():]
        out.append(line)
    return out


def split_quote(content: str) -> Tuple[str, str]:
    """WechatExporter 把引用回复写成“「被引用的人：原文」+ 分隔线 + 回复”，拆成 (回复, 引用)。"""
    if content.startswith("「") and QUOTE_SEPARATOR in content:
        quote, reply = content.split(QUOTE_SEPARATOR, 1)
        return reply, quote.strip().strip("「」")
    return content, ""


def parse_txt(text: str, tz: timezone, layout: Optional[int] = None) -> dict:
    lines = text.splitlines()
    if layout is None:
        layout = detect_layout(lines)
    if layout is None:
        raise ParseError(
            "没有找到能识别的消息抬头行。支持的 TXT 格式见 README；"
            "如果这其实是 CSV/JSON，请用 --format 指定"
        )
    name, rx, content_below = TXT_LAYOUTS[layout]
    exporter = layout == WECHAT_EXPORTER
    if exporter:
        lines = split_glued_lines(lines, rx)

    records: List[dict] = []
    current: Optional[dict] = None
    title = ""
    skipped = 0
    depth = 0  # 转发的聊天记录可能嵌套
    for line in lines:
        if depth:
            # 转发记录里的消息不属于这个会话，原样并入转发它的那条消息
            current["lines"].append(line)
            if FORWARD_START_RE.match(line):
                depth += 1
            elif FORWARD_END_RE.match(line):
                depth -= 1
            continue
        m = rx.match(line)
        when = parse_time(m["time"], tz) if m else None
        if when is not None:
            current = {"time": when, "sender": m["name"].strip(), "type": None,
                       "lines": [] if content_below else [m["content"]]}
            records.append(current)
        elif current is None:
            if not title and not records and TITLE_RE.match(line.strip()):
                title = TITLE_RE.match(line.strip()).group(1)
            elif line.strip():
                skipped += 1  # 第一条消息之前的标题、分隔线等
        elif exporter and FORWARD_START_RE.match(line):
            depth = 1
            current["type"] = "聊天记录"
            current["lines"].append(line)
        elif exporter and is_notice(line):
            # 系统提示没有自己的时间，沿用上一条消息的时间
            current = {"time": current["time"], "sender": "系统", "type": "系统",
                       "lines": [SYSTEM_PREFIX_RE.sub("", line.strip())]}
            records.append(current)
        else:
            current["lines"].append(line)

    rows = []
    for r in records:
        content, quote = split_quote("\n".join(r["lines"]).strip())
        rows.append({"time": r["time"], "sender": r["sender"], "content": content,
                     "quote": quote, "type": r["type"]})
    return {"rows": rows, "layout": name, "skipped": skipped, "title": title}


# ---------------------------------------------------------------- CSV / JSON

COLUMN_ALIASES = {
    "time": ("StrTime", "时间", "发送时间", "消息时间", "datetime", "time", "date", "日期",
             "CreateTime", "create_time", "timestamp", "msg_time"),
    "sender": ("sender", "发送人", "发送者", "发言人", "sender_name", "from", "Remark", "备注",
               "NickName", "昵称", "name", "用户"),
    "content": ("StrContent", "content", "内容", "消息内容", "消息", "msg", "message", "text"),
    "is_self": ("IsSender", "is_self", "is_send", "is_sender", "isSend", "是否自己", "是否发送者",
                "self"),
    "type": ("type_name", "类型", "消息类型", "msg_type", "Type"),
    "conversation": ("会话", "聊天对象", "群名", "chat", "conversation", "room_name", "chat_name",
                     "TalkerId", "StrTalker", "talker"),
}
COLUMN_LABELS = {"time": "时间", "sender": "发送人", "content": "内容", "is_self": "是否自己",
                 "type": "类型", "conversation": "会话"}
COLUMN_FLAGS = {"time": "time", "sender": "sender", "content": "content", "is_self": "self",
                "type": "type", "conversation": "chat"}
TRUE_VALUES = {"1", "true", "t", "yes", "y", "是", "我"}
FALSE_VALUES = {"0", "false", "f", "no", "n", "否"}


def norm_column(name: str) -> str:
    return re.sub(r"[\s_\-]", "", str(name)).lower()


def resolve_columns(fieldnames: Sequence[str], overrides: Dict[str, Optional[str]]) -> Dict[str, List[str]]:
    """为每个字段找对应的列。时间和发送人可能有多个候选列（如 StrTime 和 CreateTime），按顺序逐个尝试。"""
    by_norm = {}
    for name in fieldnames:
        by_norm.setdefault(norm_column(name), name)
    used = set()
    found: Dict[str, List[str]] = {}
    for key, aliases in COLUMN_ALIASES.items():
        if overrides.get(key):
            col = overrides[key]
            if col not in fieldnames:
                raise ParseError(f"--col-{COLUMN_FLAGS[key]} 指定的列 {col!r} 不存在。"
                                 f"现有列：{', '.join(fieldnames)}")
            found[key] = [col]
            used.add(col)
            continue
        cols = []
        for alias in aliases:
            col = by_norm.get(norm_column(alias))
            if col and col not in used and col not in cols:
                cols.append(col)
        if cols:
            found[key] = cols if key in ("time", "sender") else cols[:1]
            used.update(found[key])
    for key in ("time", "content"):
        if key not in found:
            raise ParseError(f"找不到{COLUMN_LABELS[key]}列。现有列：{', '.join(fieldnames)}。"
                             f"请用 --col-{COLUMN_FLAGS[key]} 指定")
    return found


def parse_bool(value) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    text = "" if value is None else str(value).strip().lower()
    if text in TRUE_VALUES:
        return True
    if text in FALSE_VALUES:
        return False
    return None


def as_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def parse_table(rows: List[dict], fieldnames: Sequence[str], tz: timezone,
                overrides: Dict[str, Optional[str]]) -> Tuple[List[dict], Dict[str, str], int]:
    cols = resolve_columns(fieldnames, overrides)
    first = lambda key: cols[key][0] if key in cols else None  # noqa: E731
    records, skipped = [], 0
    for row in rows:
        when = None
        for col in cols["time"]:
            when = parse_time(row.get(col), tz)
            if when is not None:
                break
        if when is None and len(cols["time"]) >= 2:
            # 日期和时间分在两列的情况
            a, b = (as_text(row.get(c)).strip() for c in cols["time"][:2])
            when = parse_time(f"{a} {b}", tz) or parse_time(f"{b} {a}", tz)
        if when is None:
            skipped += 1
            continue
        sender = next((v for v in (as_text(row.get(c)).strip() for c in cols.get("sender", [])) if v), "")
        records.append({
            "time": when,
            "sender": sender,
            "content": as_text(row.get(first("content"))),
            "is_self": parse_bool(row.get(first("is_self"))) if first("is_self") else None,
            "type": row.get(first("type")) if first("type") else None,
            "conversation": as_text(row.get(first("conversation"))).strip() if first("conversation") else "",
        })
    mapping = {COLUMN_LABELS[key]: " / ".join(names) for key, names in cols.items()}
    return records, mapping, skipped


def read_csv_rows(text: str) -> Tuple[List[dict], List[str]]:
    csv.field_size_limit(min(sys.maxsize, 2**31 - 1))  # 卡片类消息的内容可能是很长的 XML
    head = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(head, delimiters=",\t;|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text, newline=""), dialect=dialect)
    rows = list(reader)
    return rows, list(reader.fieldnames or [])


def find_records(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("messages", "msgs", "data", "records", "list", "items", "chat"):
            value = data.get(key)
            if isinstance(value, list):
                return value
            if isinstance(value, dict):
                nested = find_records(value)
                if nested:
                    return nested
        for value in data.values():
            if isinstance(value, list) and value and isinstance(value[0], dict):
                return value
    return []


def read_json_rows(text: str, lines: bool) -> Tuple[List[dict], List[str]]:
    try:
        if lines:
            data = [json.loads(line) for line in text.splitlines() if line.strip()]
        else:
            data = find_records(json.loads(text))
    except json.JSONDecodeError as exc:
        raise ParseError(f"JSON 解析失败：{exc}") from exc
    rows = [r for r in data if isinstance(r, dict)]
    if not rows:
        raise ParseError("JSON 里没有找到消息列表（应为对象数组，或含 messages/data 等数组字段的对象）")
    fieldnames = list(dict.fromkeys(k for r in rows[:500] for k in r))
    return rows, fieldnames


# ---------------------------------------------------------------- 读取单个文件

def detect_format(path: Path, text: str) -> str:
    ext = path.suffix.lower()
    if ext in (".csv", ".tsv"):
        return "csv"
    if ext == ".jsonl":
        return "jsonl"
    if ext == ".json":
        return "json"
    if ext in (".txt", ".text", ".log"):
        return "txt"
    if text.lstrip()[:1] in ("[", "{"):
        try:
            json.loads(text)
            return "json"
        except json.JSONDecodeError:
            pass
    return "txt"


def load_file(path: Path, fmt: str, tz: timezone, overrides: Dict[str, Optional[str]],
              chat: Optional[str], me_label: str) -> Tuple[List[Message], Source]:
    text, encoding = read_text(path)
    fmt = detect_format(path, text) if fmt == "auto" else fmt
    source = Source(path=str(path), format=fmt.upper(), encoding=encoding)
    title = ""
    if fmt == "txt":
        parsed = parse_txt(text, tz)
        records, source.layout, source.skipped, title = (
            parsed["rows"], parsed["layout"], parsed["skipped"], parsed["title"])
    else:
        rows, fieldnames = read_csv_rows(text) if fmt == "csv" else read_json_rows(text, fmt == "jsonl")
        records, source.columns, source.skipped = parse_table(rows, fieldnames, tz, overrides)

    # WechatExporter 每个会话一个文件夹，文件都叫 index.txt
    default_chat = title or (path.parent.name if path.stem.lower() == "index" else path.stem)
    messages = []
    for r in records:
        content = clean_text(r["content"])
        sender = clean_text(r["sender"])
        is_self = r.get("is_self")
        if raw_kind(r.get("type")) == "系统":
            # 系统提示没有真正的发送人，表格里那一列通常只是会话对象
            sender, is_self = "系统", False
        elif is_self:
            # 数据库类导出里“备注/昵称”列常常是对方的信息，自己发的消息统一记为自己
            sender = me_label
        elif not sender:
            sender = "对方"
        kind = classify(r.get("type"), content, sender)
        if not content and kind == "文本":
            source.skipped += 1  # 空消息
            continue
        messages.append(Message(
            time=r["time"], sender=sender, content=content, type=kind, is_self=is_self,
            conversation=chat or r.get("conversation") or default_chat,
            quote=clean_text(r.get("quote") or ""),
        ))
    source.parsed = len(messages)
    return messages, source


def expand_inputs(inputs: Sequence[str], out: Path) -> List[Tuple[Path, bool]]:
    """展开输入，返回 (文件, 是否来自目录)。"""
    out = out.resolve()
    paths: List[Tuple[Path, bool]] = []
    for item in inputs:
        p = Path(item)
        if p.is_dir():
            # 跳过输出目录，免得把上一次的整理结果当成输入
            paths.extend((f, True) for f in sorted(p.rglob("*"))
                         if f.is_file() and f.suffix.lower() in SUPPORTED_SUFFIXES
                         and out not in f.resolve().parents)
        elif p.is_file():
            paths.append((p, False))
        else:
            raise ParseError(f"找不到输入文件：{item}")
    if not paths:
        raise ParseError("输入目录里没有 txt/csv/json 文件")
    return paths


# ---------------------------------------------------------------- 清洗

def message_key(m: Message) -> tuple:
    return (m.time, m.sender, m.type, m.content)


def merge(per_file: List[List[Message]]) -> Tuple[List[Message], int]:
    """合并多个文件并去掉文件之间重叠的消息。

    同一文件内的重复不去掉（例如一分钟内连发两张图，在只精确到分钟的导出里是两条完全相同的记录）。
    跨文件时，每种消息保留的条数取各文件中的最大值，所以两份时间段重叠的导出合并后不会重复。
    """
    kept_so_far: Counter = Counter()
    merged: List[Message] = []
    removed = 0
    for messages in per_file:
        seen_here: Counter = Counter()
        for m in messages:
            key = message_key(m)
            seen_here[key] += 1
            if seen_here[key] > kept_so_far[key]:
                merged.append(m)
            else:
                removed += 1
        for key, n in seen_here.items():
            kept_so_far[key] = max(kept_so_far[key], n)
    return merged, removed


def mark_self(messages: List[Message], me_names: Sequence[str]) -> None:
    if not me_names:
        return
    names = set(me_names)
    for m in messages:
        if m.is_self is None:
            m.is_self = m.sender in names


def apply_filters(messages: List[Message], start: Optional[date], end: Optional[date],
                  drop_system: bool, text_only: bool) -> Tuple[List[Message], int]:
    kept = []
    for m in messages:
        day = m.time.date()
        if start and day < start or end and day > end:
            continue
        if text_only and m.type != "文本":
            continue
        if drop_system and m.type in NOISE_TYPES:
            continue
        kept.append(m)
    return kept, len(messages) - len(kept)


def anonymize(messages: List[Message]) -> List[dict]:
    """把发送人和会话名换成代号，并替换正文里出现的这些名字。返回对照表。"""
    mapping: Dict[str, str] = {}
    kinds: Dict[str, str] = {}
    members = 0
    for m in messages:
        if m.sender in mapping:
            continue
        if m.is_self:
            mapping[m.sender] = "我"
        elif m.sender.lower() in SYSTEM_SENDERS:
            mapping[m.sender] = m.sender
        else:
            members += 1
            mapping[m.sender] = f"成员{members:02d}"
        kinds[m.sender] = "发送人"
    chats = 0
    for m in messages:
        if m.conversation not in mapping:
            chats += 1
            mapping[m.conversation] = f"会话{chats:02d}"
            kinds[m.conversation] = "会话"

    # 正文按字面替换：单字名和占位的“对方”容易误伤，跳过；长名字优先，避免“张三丰”变成“成员01丰”
    names = sorted((n for n in mapping if len(n) >= 2 and n != "对方" and mapping[n] != n),
                   key=len, reverse=True)
    pattern = re.compile("|".join(map(re.escape, names))) if names else None
    for m in messages:
        m.sender = mapping[m.sender]
        m.conversation = mapping[m.conversation]
        if pattern:
            m.content = pattern.sub(lambda hit: mapping[hit.group()], m.content)
            m.quote = pattern.sub(lambda hit: mapping[hit.group()], m.quote)
    return [{"原名": name, "代号": alias, "类别": kinds[name]}
            for name, alias in mapping.items() if name != alias]


PII_PATTERNS = (
    (re.compile(r"(?<![0-9A-Za-z])\d{17}[\dXx](?![0-9A-Za-z])"), "[身份证号]"),
    (re.compile(r"(?<!\d)\d{16,19}(?!\d)"), "[卡号]"),
    (re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)"), "[手机号]"),
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "[邮箱]"),
)


def mask_pii(messages: List[Message]) -> int:
    total = 0
    for m in messages:
        for rx, label in PII_PATTERNS:
            m.content, n = rx.subn(label, m.content)
            m.quote, k = rx.subn(label, m.quote)
            total += n + k
    return total


# ---------------------------------------------------------------- 输出

FIELDS = ["id", "conversation", "datetime", "date", "time", "weekday", "hour",
          "sender", "is_self", "type", "content", "quote", "length", "timestamp"]


def to_record(index: int, m: Message, tz: timezone) -> dict:
    stamp = m.time.strftime("%Y-%m-%d %H:%M:%S")
    return {
        "id": index,
        "conversation": m.conversation,
        "datetime": stamp,
        "date": stamp[:10],
        "time": stamp[11:],
        "weekday": WEEKDAYS[m.time.weekday()],
        "hour": m.time.hour,
        "sender": m.sender,
        "is_self": m.is_self,
        "type": m.type,
        "content": m.content,
        "quote": m.quote,
        "length": len(m.content) if m.type == "文本" else 0,
        "timestamp": int(m.time.replace(tzinfo=tz).timestamp()),
    }


def display_content(m: Message) -> str:
    if m.type in ("文本", "系统", "撤回", "拍一拍"):
        return m.content + (f"  〔引用 {m.quote}〕" if m.quote else "")
    if m.type == "聊天记录":
        return f"[聊天记录] {m.content.splitlines()[0] if m.content else ''}"
    if not m.content or m.content.startswith("<") or len(m.content) > 200:
        return f"[{m.type}]"  # CSV 导出里卡片、图片的内容常是 XML 或文件路径
    return m.content if m.content.startswith("[") else f"[{m.type}] {m.content}"


def render_chat(messages: List[Message]) -> str:
    """按会话分组的可读文本，每天一个小标题，适合直接阅读或交给 AI 分析。"""
    groups: Dict[str, List[Message]] = {}
    for m in messages:
        groups.setdefault(m.conversation, []).append(m)
    out: List[str] = []
    for chat, items in groups.items():
        out.append(f"# {chat}")
        day = None
        for m in items:
            if m.time.date() != day:
                day = m.time.date()
                out.append(f"\n—— {day:%Y-%m-%d} {WEEKDAYS[day.weekday()]} ——")
            body = display_content(m).replace("\n", "\n      ")
            if m.type in NOISE_TYPES:
                out.append(f"{m.time:%H:%M} · {body}")
            else:
                out.append(f"{m.time:%H:%M} {m.sender}：{body}")
        out.append("")
    return "\n".join(out)


def build_summary(messages: List[Message], sources: List[Source], removed: int,
                  filtered: int, masked: Optional[int], notes: List[str]) -> dict:
    summary: dict = {
        "sources": [asdict(s) for s in sources],
        "counts": {"messages": len(messages), "duplicates_removed": removed,
                   "filtered_out": filtered, "skipped_lines": sum(s.skipped for s in sources)},
        "notes": notes,
    }
    if masked is not None:
        summary["counts"]["pii_masked"] = masked
    if not messages:
        return summary

    first, last = messages[0].time, messages[-1].time
    days = Counter(m.time.date() for m in messages)
    span = (last.date() - first.date()).days + 1
    summary["range"] = {
        "first": first.strftime("%Y-%m-%d %H:%M:%S"),
        "last": last.strftime("%Y-%m-%d %H:%M:%S"),
        "span_days": span,
        "active_days": len(days),
        "per_active_day": round(len(messages) / len(days), 1),
    }

    senders: Dict[str, dict] = {}
    for m in messages:
        s = senders.setdefault(m.sender, {"sender": m.sender, "is_self": m.is_self, "messages": 0,
                                          "text_messages": 0, "text_chars": 0})
        s["messages"] += 1
        if m.type == "文本":
            s["text_messages"] += 1
            s["text_chars"] += len(m.content)
    for s in senders.values():
        s["share"] = round(s["messages"] / len(messages), 4)
        s["avg_text_chars"] = round(s["text_chars"] / s["text_messages"], 1) if s["text_messages"] else 0
    summary["senders"] = sorted(senders.values(), key=lambda s: -s["messages"])
    summary["types"] = [{"type": t, "messages": n} for t, n in Counter(m.type for m in messages).most_common()]
    summary["conversations"] = [{"conversation": c, "messages": n}
                                for c, n in Counter(m.conversation for m in messages).most_common()]
    summary["by_month"] = dict(sorted(Counter(m.time.strftime("%Y-%m") for m in messages).items()))
    hours = Counter(m.time.hour for m in messages)
    summary["by_hour"] = [hours.get(h, 0) for h in range(24)]
    weekdays = Counter(m.time.weekday() for m in messages)
    summary["by_weekday"] = {WEEKDAYS[i]: weekdays.get(i, 0) for i in range(7)}
    summary["top_days"] = [{"date": d.isoformat(), "weekday": WEEKDAYS[d.weekday()], "messages": n}
                           for d, n in sorted(days.items(), key=lambda kv: (-kv[1], kv[0]))[:10]]
    return summary


def bar(n: int, peak: int, width: int = 24) -> str:
    return "█" * max(1, round(n / peak * width)) if n and peak else ""


def render_summary(summary: dict) -> str:
    c = summary["counts"]
    lines = ["# 聊天记录整理摘要", ""]
    for s in summary["sources"]:
        how = s["layout"] or "，".join(f"{k}←{v}" for k, v in s["columns"].items())
        lines.append(f"- 来源 `{Path(s['path']).name}`：{s['format']}，{how}；编码 {s['encoding']}；"
                     f"解析 {s['parsed']:,} 条，跳过 {s['skipped']:,} 行")
    extra = [f"跨文件去重 {c['duplicates_removed']:,} 条", f"按条件过滤 {c['filtered_out']:,} 条"]
    if "pii_masked" in c:
        extra.append(f"遮盖敏感信息 {c['pii_masked']:,} 处")
    lines.append(f"- 输出 **{c['messages']:,}** 条消息（{'，'.join(extra)}）")
    r = summary.get("range")
    if r:
        lines.append(f"- 时间 {r['first']} → {r['last']}，跨 {r['span_days']:,} 天，"
                     f"其中 {r['active_days']:,} 天有消息，平均每个有消息的日子 {r['per_active_day']} 条")
    for note in summary["notes"]:
        lines.append(f"- ⚠ {note}")
    if not r:
        return "\n".join(lines) + "\n"

    lines += ["", "## 发送人", "", "| 发送人 | 条数 | 占比 | 文字消息 | 文字总字数 | 平均每条字数 |",
              "|---|---:|---:|---:|---:|---:|"]
    for s in summary["senders"]:
        who = s["sender"] + ("（我）" if s["is_self"] and s["sender"] != "我" else "")
        lines.append(f"| {who} | {s['messages']:,} | {s['share']:.1%} | {s['text_messages']:,} | "
                     f"{s['text_chars']:,} | {s['avg_text_chars']} |")

    total = c["messages"]
    lines += ["", "## 消息类型", "", "| 类型 | 条数 | 占比 |", "|---|---:|---:|"]
    lines += [f"| {t['type']} | {t['messages']:,} | {t['messages'] / total:.1%} |" for t in summary["types"]]

    if len(summary["conversations"]) > 1:
        lines += ["", "## 会话", "", "| 会话 | 条数 |", "|---|---:|"]
        lines += [f"| {x['conversation']} | {x['messages']:,} |" for x in summary["conversations"]]

    def histogram(title: str, items: List[Tuple[str, int]]) -> None:
        peak = max((n for _, n in items), default=0)
        lines.extend(["", f"## {title}", "", "```"])
        width = max(len(k) for k, _ in items)
        lines.extend(f"{k.ljust(width)}  {n:>6,}  {bar(n, peak)}" for k, n in items)
        lines.append("```")

    histogram("按月", list(summary["by_month"].items()))
    histogram("按小时", [(f"{h:02d}时", n) for h, n in enumerate(summary["by_hour"])])
    histogram("按星期", list(summary["by_weekday"].items()))

    lines += ["", "## 消息最多的 10 天", "", "| 日期 | 星期 | 条数 |", "|---|---|---:|"]
    lines += [f"| {d['date']} | {d['weekday']} | {d['messages']:,} |" for d in summary["top_days"]]
    return "\n".join(lines) + "\n"


def write_outputs(out: Path, messages: List[Message], summary: dict, name_map: Optional[List[dict]],
                  tz: timezone) -> List[Path]:
    out.mkdir(parents=True, exist_ok=True)
    records = [to_record(i, m, tz) for i, m in enumerate(messages, 1)]
    written = []

    path = out / "messages.csv"  # 带 BOM，Excel 直接打开中文不乱码
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        for r in records:
            writer.writerow({**r, "is_self": "" if r["is_self"] is None else int(r["is_self"])})
    written.append(path)

    path = out / "messages.jsonl"
    with path.open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    written.append(path)

    for name, text in (("chat.txt", render_chat(messages)),
                       ("summary.md", render_summary(summary)),
                       ("summary.json", json.dumps(summary, ensure_ascii=False, indent=2) + "\n")):
        path = out / name
        path.write_text(text, encoding="utf-8")
        written.append(path)

    stale = out / "name_map.csv"
    if name_map is not None:
        with stale.open("w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["原名", "代号", "类别"])
            writer.writeheader()
            writer.writerows(name_map)
        written.append(stale)
    elif stale.exists():
        stale.unlink()  # 上一次匿名化留下的对照表与本次输出无关
    return written


# ---------------------------------------------------------------- 命令行

def split_names(text: Optional[str]) -> List[str]:
    return [n.strip() for n in re.split(r"[,，]", text or "") if n.strip()]


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="把导出的微信聊天记录（TXT / CSV / JSON）整理成统一结构的 CSV、JSONL、可读文本和统计摘要。",
    )
    p.add_argument("inputs", nargs="+", help="导出的聊天记录文件或目录，可以给多个，会合并并去掉文件间重叠的消息")
    p.add_argument("-o", "--out", default=str(HERE / "output"), help="输出目录（默认：脚本旁的 output/）")
    p.add_argument("--format", choices=["auto", "txt", "csv", "json", "jsonl"], default="auto",
                   help="输入格式，默认按扩展名和内容自动判断")
    p.add_argument("--me", help="你自己在记录里显示的名字，多个用逗号分隔；用于标记哪些消息是你发的")
    p.add_argument("--chat", help="会话名；不填时依次用数据里的会话列、文件开头的标题、文件名")
    p.add_argument("--start", type=parse_day, help="只保留这一天及之后的消息，格式 YYYY-MM-DD")
    p.add_argument("--end", type=parse_day, help="只保留这一天及之前的消息，格式 YYYY-MM-DD")
    p.add_argument("--drop-system", action="store_true", help="去掉系统提示、撤回、拍一拍")
    p.add_argument("--text-only", action="store_true", help="只保留文字消息")
    p.add_argument("--anonymize", action="store_true",
                   help="把人名、会话名换成代号（我 / 成员01 / 会话01），对照表另存 name_map.csv")
    p.add_argument("--mask-pii", action="store_true", help="遮盖正文里的手机号、身份证号、银行卡号、邮箱")
    p.add_argument("--utc-offset", type=float, default=8,
                   help="Unix 时间戳换算成本地时间用的时区，默认 8（北京时间）")
    for key in ("time", "sender", "content", "self", "type", "chat"):
        p.add_argument(f"--col-{key}", metavar="列名", help=f"CSV/JSON 中{COL_HELP[key]}所在的列，自动识别不对时手动指定")
    return p


COL_HELP = {"time": "时间", "sender": "发送人", "content": "消息内容", "self": "“是否自己发送”",
            "type": "消息类型", "chat": "会话名"}


def guess_self_hint(messages: List[Message]) -> str:
    """多个会话里都出现的发送人通常就是你自己，给出提示（不自动采用）。"""
    senders: Dict[str, set] = {}
    for m in messages:
        if m.sender not in ("系统", "对方"):
            senders.setdefault(m.conversation, set()).add(m.sender)
    if len(senders) < 2:
        return ""
    common = set.intersection(*senders.values())
    if len(common) != 1:
        return ""
    name = common.pop()
    return f"。所有会话里都出现的发送人只有「{name}」，多半就是你，可以加上 --me \"{name}\" 重新运行"


def run(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    tz = timezone(timedelta(hours=args.utc_offset))
    me_names = split_names(args.me)
    overrides = {"time": args.col_time, "sender": args.col_sender, "content": args.col_content,
                 "is_self": args.col_self, "type": args.col_type, "conversation": args.col_chat}
    log = lambda text: print(text, file=sys.stderr)  # noqa: E731

    notes = []
    try:
        paths = expand_inputs(args.inputs, Path(args.out))
        per_file, sources, unreadable = [], [], []
        for path, from_dir in paths:
            try:
                messages, source = load_file(path, args.format, tz, overrides, args.chat,
                                             me_names[0] if me_names else "我")
            except ParseError as exc:
                if not from_dir:
                    raise
                # 目录里常有会话列表之类不含消息的文件，跳过即可
                log(f"跳过 {path}：{exc}")
                unreadable.append(f"{path.parent.name}/{path.name}")
                continue
            per_file.append(messages)
            sources.append(source)
            how = source.layout or "，".join(f"{k}←{v}" for k, v in source.columns.items())
            log(f"读取 {path}：{source.format}（{how}），{source.encoding}，"
                f"{source.parsed} 条消息，跳过 {source.skipped} 行")
    except ParseError as exc:
        log(f"错误：{exc}")
        return 1
    if not sources:
        log("错误：输入目录里没有能识别的聊天记录文件")
        return 1
    if unreadable:
        notes.append(f"跳过了 {len(unreadable)} 个无法识别的文件：{'、'.join(unreadable[:5])}"
                     + ("等" if len(unreadable) > 5 else ""))

    messages, removed = merge(per_file)
    mark_self(messages, me_names)
    messages.sort(key=lambda m: m.time)  # 稳定排序，同一秒内保持原文件里的先后
    messages, filtered = apply_filters(messages, args.start, args.end, args.drop_system, args.text_only)

    if any(m.is_self is None for m in messages):
        notes.append("有消息无法判断是否为你本人发送（数据里没有对应列，也没有用 --me 指定你的名字），is_self 留空"
                     + guess_self_hint(messages))
    elif me_names and not any(m.is_self for m in messages):
        notes.append(f"没有找到 --me 指定的名字（{'、'.join(me_names)}）发送的消息，请核对名字是否与记录中一致")
    unknown_sender = sum(1 for m in messages if m.sender == "对方")
    if unknown_sender:
        notes.append(f"{unknown_sender} 条消息没有发送人，记为“对方”")
    if not messages:
        notes.append("没有剩下任何消息，请检查输入文件和过滤条件")

    name_map = anonymize(messages) if args.anonymize else None
    masked = mask_pii(messages) if args.mask_pii else None
    summary = build_summary(messages, sources, removed, filtered, masked, notes)
    written = write_outputs(Path(args.out), messages, summary, name_map, tz)

    log(f"\n共 {len(messages)} 条消息（跨文件去重 {removed} 条，过滤 {filtered} 条）")
    for note in notes:
        log(f"注意：{note}")
    log("已写入：")
    for path in written:
        log(f"  {path}")
    if name_map is not None:
        log("提示：name_map.csv 能把代号还原成真名，分享数据时不要附带它")
    return 0


if __name__ == "__main__":
    sys.exit(run())
