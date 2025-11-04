#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unicode Braille to BRF ASCII conversion utility.
Can be used as a standalone script or imported as a module.
"""

import sys
import re

# Mapping: Unicode Braille glyph → ASCII Braille glyph
UNICODE_TO_BRF = {
    '\u2800': ' ',   # Braille blank (U+2800)
    ' ': ' ',        # Normal space
    '\u00A0': ' ',   # Non-breaking space (NBSP)
    '\u282E': '!',   # ⠮
    '\u2810': '"',   # ⠐
    '\u283C': '#',   # ⠼
    '\u282B': '$',   # ⠫
    '\u2829': '%',   # ⠩
    '\u282F': '&',   # ⠯
    '\u2804': "'",   # ⠄
    '\u2837': '(',   # ⠷
    '\u283E': ')',   # ⠾
    '\u2821': '*',   # ⠡
    '\u282C': '+',   # ⠬
    '\u2820': ',',   # ⠠
    '\u2824': '-',   # ⠤
    '\u2828': '.',   # ⠨
    '\u280C': '/',   # ⠌
    '\u2834': '0',   # ⠴
    '\u2802': '1',   # ⠂
    '\u2806': '2',   # ⠆
    '\u2812': '3',   # ⠒
    '\u2832': '4',   # ⠲
    '\u2822': '5',   # ⠢
    '\u2816': '6',   # ⠖
    '\u2836': '7',   # ⠶
    '\u2826': '8',   # ⠦
    '\u2814': '9',   # ⠔
    '\u2831': ':',   # ⠱
    '\u2830': ';',   # ⠰
    '\u2823': '<',   # ⠣
    '\u283F': '=',   # ⠿
    '\u281C': '>',   # ⠜
    '\u2839': '?',   # ⠹
    '\u2808': '@',   # ⠈
    '\u2801': 'A',   # ⠁
    '\u2803': 'B',   # ⠃
    '\u2809': 'C',   # ⠉
    '\u2819': 'D',   # ⠙
    '\u2811': 'E',   # ⠑
    '\u280B': 'F',   # ⠋
    '\u281B': 'G',   # ⠛
    '\u2813': 'H',   # ⠓
    '\u280A': 'I',   # ⠊
    '\u281A': 'J',   # ⠚
    '\u2805': 'K',   # ⠅
    '\u2807': 'L',   # ⠇
    '\u280D': 'M',   # ⠍
    '\u281D': 'N',   # ⠝
    '\u2815': 'O',   # ⠕
    '\u280F': 'P',   # ⠏
    '\u281F': 'Q',   # ⠟
    '\u2817': 'R',   # ⠗
    '\u280E': 'S',   # ⠎
    '\u281E': 'T',   # ⠞
    '\u2825': 'U',   # ⠥
    '\u2827': 'V',   # ⠧
    '\u283A': 'W',   # ⠺
    '\u282D': 'X',   # ⠭
    '\u283D': 'Y',   # ⠽
    '\u2835': 'Z',   # ⠵
    '\u282A': '[',   # ⠪
    '\u2833': '\\',  # ⠳
    '\u283B': ']',   # ⠻
    '\u2818': '^',   # ⠘
    '\u2838': '_',   # ⠸
}


def unicode_to_brf(unicode_text: str) -> str:
    """
    Convert Unicode Braille text to BRF ASCII encoding.
    
    Args:
        unicode_text: Unicode Braille text string
        
    Returns:
        BRF ASCII encoded string
    """
    # Normalize all types of spaces
    text = unicode_text.replace('\u00A0', ' ').replace('\u2800', ' ')
    
    # Remove unintended consecutive Braille symbols like ⠹⠹
    text = re.sub(r'(\u2839)\1+', r'\1', text)
    
    # Convert each character
    brf_chars = []
    for ch in text:
        if ch in UNICODE_TO_BRF:
            brf_chars.append(UNICODE_TO_BRF[ch])
        else:
            # Check if it's a Braille character (U+2800 to U+28FF)
            code_point = ord(ch)
            if 0x2800 <= code_point <= 0x28FF:
                # It's a Braille character but not in our mapping
                print(f"⚠ Warning: Unmapped Braille symbol '{ch}' (U+{code_point:04X})", file=sys.stderr)
                brf_chars.append('?')
            else:
                # Non-Braille character - keep as is (for Tamil text headers, etc.)
                brf_chars.append(ch)
    
    return ''.join(brf_chars)


def main():
    """Main function for command-line usage."""
    if len(sys.argv) < 2:
        # Read from stdin if no arguments
        unicode_text = sys.stdin.read()
    else:
        # Use first argument as input
        unicode_text = sys.argv[1]
    
    brf_content = unicode_to_brf(unicode_text)
    print(brf_content, end='')


if __name__ == '__main__':
    main()
