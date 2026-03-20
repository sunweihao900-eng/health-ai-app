"""
个人信息（PII）脱敏服务
依据《个人信息保护法》（PIPL）要求，在存储前对以下信息脱敏：
- 手机号、身份证号、姓名、地址、邮箱、银行卡号
"""
import re
from typing import Tuple


# ──────────────────────────────────────────────
# 脱敏规则
# ──────────────────────────────────────────────
PII_RULES = [
    # 手机号（13x/14x/15x/16x/17x/18x/19x）
    (
        r"(?<!\d)(1[3-9]\d{9})(?!\d)",
        lambda m: m.group(1)[:3] + "****" + m.group(1)[-4:],
        "phone",
    ),
    # 身份证号（18位，使用非数字边界避免汉字后\b失效）
    (
        r"(?<!\d)(\d{6})(\d{8})(\d{3}[\dXx])(?!\d)",
        lambda m: m.group(1) + "********" + m.group(3)[-1],
        "id_card",
    ),
    # 邮箱
    (
        r"([a-zA-Z0-9._%+\-]+)@([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})",
        lambda m: m.group(1)[:2] + "***@" + m.group(2),
        "email",
    ),
    # 银行卡号（16-19位数字）
    (
        r"(?<!\d)(\d{4})\s?(\d{4})\s?(\d{4})\s?(\d{4,7})(?!\d)",
        lambda m: m.group(1) + " **** **** " + m.group(4)[-4:],
        "bank_card",
    ),
    # 家庭住址（粗粒度）
    (
        r"(住在|家住|地址[是为：:]\s*|我住|住址[是为：:]\s*)"
        r"([^\s,，。！？]{5,30})",
        lambda m: m.group(1) + "[地址已脱敏]",
        "address",
    ),
]

# 姓名脱敏（基于「我叫/我是/姓名」前缀，取2-4个汉字）
NAME_PATTERN = re.compile(
    r"(我叫|我是|姓名[是为：:]\s*|我的名字[是叫]?\s*)"
    r"([\u4e00-\u9fa5]{2,4})"
)


class PIIService:
    """PII脱敏服务"""

    def anonymize(self, text: str) -> Tuple[str, list]:
        """
        对文本进行PII脱敏。
        返回 (脱敏后文本, 检测到的PII类型列表)
        """
        result = text
        detected_types = []

        # 应用各PII规则
        for pattern, replacement, pii_type in PII_RULES:
            new_result = re.sub(pattern, replacement, result)
            if new_result != result:
                detected_types.append(pii_type)
                result = new_result

        # 姓名脱敏
        def replace_name(m):
            name = m.group(2)
            return m.group(1) + name[0] + "*" * (len(name) - 1)

        new_result = NAME_PATTERN.sub(replace_name, result)
        if new_result != result:
            detected_types.append("name")
            result = new_result

        return result, detected_types

    def has_pii(self, text: str) -> bool:
        """检测文本是否含有PII"""
        _, detected = self.anonymize(text)
        return len(detected) > 0

    def anonymize_messages(self, messages: list) -> list:
        """对消息列表批量脱敏，返回新列表（不修改原始数据）"""
        cleaned = []
        for msg in messages:
            if isinstance(msg, dict):
                content, _ = self.anonymize(msg.get("content", ""))
                cleaned.append({**msg, "content": content})
            else:
                content, _ = self.anonymize(msg.content)
                # 返回dict格式
                cleaned.append({"role": msg.role, "content": content})
        return cleaned


# 单例
pii_service = PIIService()
