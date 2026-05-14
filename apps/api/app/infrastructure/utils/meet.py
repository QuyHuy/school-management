from __future__ import annotations

import random
import string


def generate_meet_link() -> str:
    def seg(n: int) -> str:
        return "".join(random.choices(string.ascii_lowercase, k=n))

    return f"meet.google.com/{seg(3)}-{seg(4)}-{seg(3)}"
