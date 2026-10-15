#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
start_game.py
斗地主宗师游戏一键本地服务启动器
自动启动本地 HTTP 服务器并在默认浏览器中打开游戏页面
"""

import os
import sys
import webbrowser
import socket
from http.server import HTTPServer, SimpleHTTPRequestHandler

def find_available_port(start_port=8080, max_port=8099):
    for port in range(start_port, max_port + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
    return start_port

def run():
    game_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(game_dir)

    port = find_available_port(8080)
    server_address = ('127.0.0.1', port)
    
    print("=" * 60)
    print("   🎴 斗地主宗师 (Fight The Landlord Master) 启动器 🎴")
    print("=" * 60)
    print(f"[*] 游戏根目录: {game_dir}")
    print(f"[*] 服务地址: http://127.0.0.1:{port}/")
    print("[*] 正在打开系统默认浏览器...")
    print("=" * 60)

    url = f"http://127.0.0.1:{port}/index.html"
    webbrowser.open(url)

    httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)
    try:
        print("[*] HTTP 服务已就绪，按 Ctrl+C 停止服务。")
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] 服务已停止，感谢游玩！")
        httpd.server_close()

if __name__ == '__main__':
    run()
