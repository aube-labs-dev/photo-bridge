#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Photo Bridge 특허 도면 5매 생성 (흑백 라인 드로잉, 부호 포함)."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from matplotlib.lines import Line2D

for c in ["AppleGothic", "AppleSDGothicNeo", "NanumGothic", "Malgun Gothic"]:
    if c in {f.name for f in fm.fontManager.ttflist}:
        plt.rcParams["font.family"] = c
        break
plt.rcParams["axes.unicode_minus"] = False
LW = 1.6
OUT = "/Users/jonghwa/dev/source/photo-bridge/docs/patent/patent_figures"


def box(ax, x, y, w, h, text, ref=None, fs=10, style="square"):
    bs = "square,pad=0.02" if style == "square" else "round,pad=0.02"
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=bs, fill=False,
                                edgecolor="black", linewidth=LW))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fs)
    if ref:
        ax.text(x + w - 0.04, y + h + 0.06, ref, ha="right", va="bottom",
                fontsize=fs - 1, style="italic")


def arrow(ax, x1, y1, x2, y2, text=None, fs=9, dashed=False, rad=0.0,
          lab_ha="center", lab_dx=0.0, lab_dy=0.12):
    ls = (0, (4, 3)) if dashed else "solid"
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>",
                 mutation_scale=14, linewidth=LW, color="black", linestyle=ls,
                 connectionstyle=f"arc3,rad={rad}"))
    if text:
        ax.text((x1 + x2) / 2 + lab_dx, (y1 + y2) / 2 + lab_dy, text,
                ha=lab_ha, va="bottom", fontsize=fs,
                bbox=dict(facecolor="white", edgecolor="none", pad=0.6))


def newfig(title):
    fig, ax = plt.subplots(figsize=(8.0, 6.0))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 9)
    ax.axis("off")
    ax.text(6, 8.6, title, ha="center", va="center", fontsize=13, fontweight="bold")
    return fig, ax


# ===== 도 1: 전체 시스템 구성도 =====
fig, ax = newfig("도 1")
box(ax, 0.6, 4.3, 3.0, 1.6, "제1 사용자 단말\n(송신 브라우저)", "100", fs=10)
box(ax, 8.4, 4.3, 3.0, 1.6, "제2 사용자 단말\n(수신 브라우저)", "200", fs=10)
box(ax, 4.4, 6.6, 3.2, 1.2, "시그널링 서버", "300", fs=10)
box(ax, 4.6, 1.0, 2.8, 1.0, "TURN 서버\n(교차망 중계)", "400", fs=9)
# P2P 직송 (굵은 양방향 느낌)
arrow(ax, 3.7, 5.1, 8.3, 5.1, "파일 P2P 직송 (DataChannel)", fs=10, lab_dy=0.18)
arrow(ax, 8.3, 4.7, 3.7, 4.7, dashed=False)
# 시그널링 (점선)
arrow(ax, 3.2, 5.9, 4.6, 6.7, "시그널링(WebSocket)", fs=8, dashed=True, lab_ha="right", lab_dx=-0.2)
arrow(ax, 8.8, 5.9, 7.4, 6.7, "시그널링", fs=8, dashed=True, lab_ha="left", lab_dx=0.2)
# TURN (점선)
arrow(ax, 2.0, 4.3, 4.6, 1.6, fs=8, dashed=True)
arrow(ax, 10.0, 4.3, 7.4, 1.6, fs=8, dashed=True)
ax.text(6, 3.6, "※ 파일 데이터는 서버(300) 미경유", ha="center", fontsize=9, style="italic")
fig.savefig(f"{OUT}/fig1.png", dpi=200, bbox_inches="tight")
plt.close(fig)


# ===== 도 2: 연결 수립 및 파일 직송 신호 흐름도 =====
fig, ax = plt.subplots(figsize=(8.0, 9.5))
ax.set_xlim(0, 12)
ax.set_ylim(0, 15)
ax.axis("off")
ax.text(6, 14.6, "도 2", ha="center", fontsize=13, fontweight="bold")
lanes = {"100": 1.8, "300": 6.0, "200": 10.2}
labels = {"100": "제1 단말(100)", "300": "시그널링 서버(300)", "200": "제2 단말(200)"}
for k, x in lanes.items():
    ax.text(x, 14.0, labels[k], ha="center", fontsize=10, fontweight="bold")
    ax.add_line(Line2D([x, x], [0.5, 13.6], linestyle=(0, (2, 2)), color="black", linewidth=1.0))

def step(y, x1, x2, text, sid, dashed=False):
    arrow(ax, lanes[x1], y, lanes[x2], y, fs=8.5, dashed=dashed)
    ax.text((lanes[x1] + lanes[x2]) / 2, y + 0.28, text, ha="center", va="bottom", fontsize=8.5,
            bbox=dict(facecolor="white", edgecolor="none", pad=0.5))
    ax.text(lanes[x1], y, sid, ha="center", va="center", fontsize=7.5,
            bbox=dict(facecolor="white", edgecolor="black", pad=0.8))

step(13.0, "100", "300", "방 입장(방 식별자)", "S110")
ax.text(6.0, 12.2, "방 인원 확인 (S120)", ha="center", fontsize=8.5,
        bbox=dict(facecolor="white", edgecolor="black", pad=1.0))
step(11.4, "200", "300", "동일 방 입장", "S130")
ax.text(6.0, 10.6, "역할 지정: 신규=비양보 / 기존=양보 (S140)", ha="center", fontsize=8.5,
        bbox=dict(facecolor="white", edgecolor="black", pad=1.0))
step(9.8, "100", "200", "제안(offer) [서버 중계]", "S150")
step(8.8, "200", "100", "응답(answer) [서버 중계]", "S160")
step(7.8, "100", "200", "연결 후보(ICE) 교환 [서버 중계]", "S170")
ax.text(6.0, 6.9, "교차망 시 TURN(400) 경로 선택 (S175)", ha="center", fontsize=8,
        bbox=dict(facecolor="white", edgecolor="black", pad=1.0), style="italic")
# 데이터 채널 개방
ax.add_patch(FancyBboxPatch((1.0, 5.4), 10.0, 0.7, boxstyle="round,pad=0.02",
             fill=False, edgecolor="black", linewidth=LW))
ax.text(6.0, 5.75, "P2P 데이터 채널 개방 (S180)  — 이후 서버 미경유", ha="center", fontsize=9)
step(4.6, "100", "200", "파일 메타 + 청크 직송", "S190")
ax.text(10.2, 3.6, "청크 누적→파일 복원 (S195)", ha="center", fontsize=8,
        bbox=dict(facecolor="white", edgecolor="black", pad=1.0))
fig.savefig(f"{OUT}/fig2.png", dpi=200, bbox_inches="tight")
plt.close(fig)


# ===== 도 3: 재접속키 기반 좀비소켓 정리 순서도 =====
fig, ax = plt.subplots(figsize=(7.0, 10.0))
ax.set_xlim(0, 10)
ax.set_ylim(0, 16)
ax.axis("off")
ax.text(5, 15.6, "도 3", ha="center", fontsize=13, fontweight="bold")

def fbox(y, text, sid, w=5.6, h=1.0):
    x = 5 - w / 2
    box(ax, x, y, w, h, text, sid, fs=9, style="round")
    return y

def diamond(cx, cy, text, sid, w=2.6, h=1.1):
    ax.add_patch(plt.Polygon([(cx, cy + h), (cx + w, cy), (cx, cy - h), (cx - w, cy)],
                 fill=False, edgecolor="black", lw=LW))
    ax.text(cx, cy, text, ha="center", va="center", fontsize=8.5)
    ax.text(cx + w, cy + h, sid, ha="right", va="bottom", fontsize=8, style="italic")

fbox(14.0, "모바일 브라우저 복귀\n→ 동일 재접속키로 재접속 시도", "S210")
arrow(ax, 5, 14.0, 5, 13.3)
fbox(12.3, "방 내 소켓 순회 시작", "S220")
arrow(ax, 5, 12.3, 5, 11.7)
diamond(5, 10.6, "동일 재접속키\n또는 비(非)개방?", "S230")
arrow(ax, 5, 9.5, 5, 8.9, "예")
fbox(7.9, "해당 소켓 종료\n(소정 종료 코드)", "S240")
arrow(ax, 5, 7.9, 5, 7.3)
fbox(6.3, "종료 코드 소켓은\n상대에 이탈 통지 안 함", "S250")
arrow(ax, 5, 6.3, 5, 5.7)
fbox(4.7, "유효 인원 재산정\n→ 정원 내이면 재접속 수락", "S260")
# '아니오' 분기
arrow(ax, 7.6, 10.6, 9.0, 10.6, "아니오")
ax.text(9.0, 10.0, "유지", ha="center", fontsize=8.5,
        bbox=dict(facecolor="white", edgecolor="black", pad=1.0))
fig.savefig(f"{OUT}/fig3.png", dpi=200, bbox_inches="tight")
plt.close(fig)


# ===== 도 4: 수신측 주도 애플리케이션 계층 흐름제어 순서도 =====
fig, ax = plt.subplots(figsize=(8.5, 9.0))
ax.set_xlim(0, 12)
ax.set_ylim(0, 15)
ax.axis("off")
ax.text(6, 14.6, "도 4", ha="center", fontsize=13, fontweight="bold")
ax.text(3.0, 13.7, "수신측 (200)", ha="center", fontsize=10, fontweight="bold")
ax.text(9.0, 13.7, "송신측 (100)", ha="center", fontsize=10, fontweight="bold")

def sbox(cx, y, text, sid, w=4.6, h=1.0):
    box(ax, cx - w / 2, y, w, h, text, sid, fs=8.5, style="round")

sbox(3.0, 12.2, "일정 수량/용량 수신 완료\n→ 배치 저장 시작", "S310")
arrow(ax, 3.0, 12.2, 3.0, 11.4)
sbox(3.0, 10.4, "전송 일시정지(flow_pause) 전송", "S320")
arrow(ax, 5.3, 10.9, 6.7, 10.9, "pause", fs=8.5, dashed=True)
sbox(9.0, 10.4, "파일 경계에서\n일시정지 확인→대기", "S330")
arrow(ax, 3.0, 10.4, 3.0, 9.6)
sbox(3.0, 8.6, "배치 저장 수행/완료", "S340")
arrow(ax, 3.0, 8.6, 3.0, 7.8)
sbox(3.0, 6.8, "전송 재개(flow_resume) 전송", "S350")
arrow(ax, 5.3, 7.3, 6.7, 7.3, "resume", fs=8.5, dashed=True)
sbox(9.0, 6.8, "다음 파일 전송 재개", "S360")
arrow(ax, 9.0, 6.8, 9.0, 6.0)
sbox(9.0, 5.0, "모든 파일 완료\n→ 전송완료(all_done) 전송", "S370")
arrow(ax, 6.7, 5.5, 4.4, 5.5, "all_done", fs=8.5, dashed=True)
sbox(3.0, 5.0, "수신 상태 표시 정리", "")
ax.text(6.0, 2.8, "※ 파일 경계에서만 적용 · 전송계층 역압([0024])과 병행", ha="center",
        fontsize=8.5, style="italic")
fig.savefig(f"{OUT}/fig4.png", dpi=200, bbox_inches="tight")
plt.close(fig)


# ===== 도 5: 시그널링 서버 구조 + 익명 집계 블록도 =====
fig, ax = newfig("도 5")
box(ax, 3.9, 7.0, 4.2, 1.0, "시그널링 서버", "300", fs=10)
# 내부 구성부
box(ax, 0.6, 5.0, 2.6, 1.0, "라우팅부", "310", fs=9)
box(ax, 3.6, 5.0, 2.6, 1.0, "방 객체", "320", fs=9)
box(ax, 6.6, 5.0, 2.6, 1.0, "협상역할 지정부", "340", fs=9)
box(ax, 9.3, 5.0, 2.4, 1.0, "익명 집계부", "350", fs=9)
box(ax, 3.6, 3.2, 2.6, 1.0, "좀비소켓 정리부", "330", fs=9)
for cx in [1.9, 4.9, 7.9, 10.5]:
    arrow(ax, 6.0, 7.0, cx, 6.0, dashed=False)
arrow(ax, 4.9, 5.0, 4.9, 4.2)
# 집계 이벤트
box(ax, 8.9, 1.2, 3.0, 1.6,
    "사건 종류별 총 횟수만:\n· 방 생성(S410)\n· 연결 성립(S420)\n· 정원 초과(S430)", None, fs=8)
arrow(ax, 10.5, 5.0, 10.4, 2.8, dashed=True)
ax.text(4.9, 1.6, "방 1개 = 1 인스턴스\n(휴면 전환 가능)\n연결 메시지 외 미저장", ha="center",
        fontsize=8.5, bbox=dict(facecolor="white", edgecolor="black", pad=2.0))
ax.text(3.0, 0.3, "※ 방 식별자/IP/기기/파일내용 등 개인 식별정보 미기록", ha="left",
        fontsize=8, style="italic")
fig.savefig(f"{OUT}/fig5.png", dpi=200, bbox_inches="tight")
plt.close(fig)

print("done: fig1~fig5 generated")
