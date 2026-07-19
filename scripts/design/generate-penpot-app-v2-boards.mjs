import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outputDir = join(process.cwd(), "output", "penpot", "pollycar-app-v2");
await mkdir(outputDir, { recursive: true });

const palette = {
  ink: "#13243A",
  ink2: "#40546D",
  muted: "#718096",
  paper: "#FFFDF8",
  fog: "#F6F3EC",
  line: "#D9D7D0",
  amber: "#E3A34A",
  amberDark: "#C88932",
  passenger: "#3D8C92",
  passengerSoft: "#E3F0EF",
  owner: "#4B72B5",
  ownerSoft: "#E6EDF8",
  safety: "#B75D50",
  safetySoft: "#F6E7E3",
  white: "#FFFFFF",
};

const commonDefs = `
  <defs>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#13243A" flood-opacity=".16"/>
    </filter>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#13243A" flood-opacity=".12"/>
    </filter>
    <linearGradient id="nightPaper" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#F9F6EF"/>
      <stop offset=".55" stop-color="#F0F3F0"/>
      <stop offset="1" stop-color="#E7EFF0"/>
    </linearGradient>
    <linearGradient id="mapPassenger" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#DDEAE7"/>
      <stop offset=".55" stop-color="#C8DCDA"/>
      <stop offset="1" stop-color="#B8D0D2"/>
    </linearGradient>
    <linearGradient id="mapOwner" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#DDE5F0"/>
      <stop offset=".55" stop-color="#CBD7E7"/>
      <stop offset="1" stop-color="#BCC9DF"/>
    </linearGradient>
    <style>
      .sans { font-family: Inter, "Noto Sans SC", "Microsoft YaHei", sans-serif; }
      .serif { font-family: "Noto Serif SC", "Songti SC", serif; }
      .ink { fill: ${palette.ink}; }
      .muted { fill: ${palette.muted}; }
      .label { font-size: 12px; font-weight: 700; letter-spacing: 1.8px; }
      .title { font-size: 34px; font-weight: 700; }
      .section { font-size: 22px; font-weight: 700; }
      .body { font-size: 15px; font-weight: 400; }
      .small { font-size: 12px; font-weight: 500; }
      .button { font-size: 16px; font-weight: 700; }
      .phone-title { font-size: 24px; font-weight: 700; }
      .phone-body { font-size: 15px; font-weight: 500; }
      .phone-small { font-size: 12px; font-weight: 500; }
    </style>
  </defs>`;

const svg = (width, height, body) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${commonDefs}
${body}
</svg>`;

const text = (x, y, value, className = "sans body ink", anchor = "start") =>
  `<text x="${x}" y="${y}" class="${className}" text-anchor="${anchor}">${escapeXml(value)}</text>`;

const rounded = (x, y, width, height, radius, fill, stroke = "none", strokeWidth = 0, extra = "") =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${extra}/>`;

const circle = (cx, cy, radius, fill, stroke = "none", strokeWidth = 0) =>
  `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

const line = (x1, y1, x2, y2, stroke, strokeWidth = 1, dash = "") =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ""}/>`;

function phoneFrame({ x, y, width, height, name, identity, identityColor, children }) {
  const screenX = x + 12;
  const screenY = y + 12;
  const screenWidth = width - 24;
  const screenHeight = height - 24;
  return `
    ${rounded(x, y, width, height, 42, palette.ink, "none", 0, 'filter="url(#shadow)"')}
    ${rounded(screenX, screenY, screenWidth, screenHeight, 32, palette.fog)}
    ${rounded(x + width / 2 - 56, y + 18, 112, 26, 13, palette.ink)}
    ${text(x + 30, y - 22, name, "sans label ink")}
    ${rounded(x + width - 118, y - 40, 108, 28, 14, identityColor)}
    ${text(x + width - 64, y - 21, identity, "sans small", "middle").replace(`class="sans small"`, `class="sans small" fill="${palette.white}"`)}
    <g clip-path="url(#clip-${x}-${y})">${children({ x: screenX, y: screenY, width: screenWidth, height: screenHeight })}</g>
    <defs><clipPath id="clip-${x}-${y}"><rect x="${screenX}" y="${screenY}" width="${screenWidth}" height="${screenHeight}" rx="32"/></clipPath></defs>`;
}

function mapRoads(x, y, width, height, accent) {
  return `
    ${rounded(x, y, width, height, 32, accent === palette.owner ? "url(#mapOwner)" : "url(#mapPassenger)")}
    <path d="M ${x - 10} ${y + height * .26} C ${x + width * .22} ${y + height * .12}, ${x + width * .48} ${y + height * .44}, ${x + width + 20} ${y + height * .22}" fill="none" stroke="${palette.paper}" stroke-width="18" opacity=".78"/>
    <path d="M ${x + width * .72} ${y - 20} C ${x + width * .56} ${y + height * .25}, ${x + width * .82} ${y + height * .55}, ${x + width * .56} ${y + height + 20}" fill="none" stroke="${palette.paper}" stroke-width="12" opacity=".72"/>
    <path d="M ${x + width * .18} ${y - 20} C ${x + width * .24} ${y + height * .3}, ${x + width * .1} ${y + height * .72}, ${x + width * .34} ${y + height + 30}" fill="none" stroke="${palette.white}" stroke-width="7" opacity=".7"/>
    <path d="M ${x + width * .36} ${y + height * .7} C ${x + width * .5} ${y + height * .58}, ${x + width * .64} ${y + height * .58}, ${x + width * .8} ${y + height * .5}" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>
    ${circle(x + width * .36, y + height * .7, 11, palette.paper, accent, 4)}
    ${circle(x + width * .8, y + height * .5, 12, accent)}
    ${circle(x + width * .8, y + height * .5, 4, palette.paper)}
    ${rounded(x + 20, y + 22, 128, 34, 17, palette.paper, "none", 0, 'filter="url(#softShadow)"')}
    ${circle(x + 38, y + 39, 6, accent)}
    ${text(x + 52, y + 44, "城市地图", "sans phone-small ink")}
  `;
}

function coverBoard() {
  return svg(1440, 900, `
    ${rounded(0, 0, 1440, 900, 0, "url(#nightPaper)")}
    ${rounded(56, 48, 1328, 804, 36, palette.paper, "none", 0, 'filter="url(#shadow)"')}
    ${rounded(56, 48, 470, 804, 36, palette.ink)}
    ${rounded(98, 92, 76, 76, 24, palette.amber)}
    ${text(136, 143, "P", "serif title ink", "middle")}
    ${text(98, 218, "POLLYCAR APP V2", "sans label", "start").replace('class="sans label"', `class="sans label" fill="${palette.amber}"`)}
    ${text(98, 282, "安静、可信、", "serif title", "start").replace('class="serif title"', `class="serif title" fill="${palette.white}"`)}
    ${text(98, 328, "有人情味的城市出行", "serif title", "start").replace('class="serif title"', `class="serif title" fill="${palette.white}"`)}
    ${text(98, 382, "不是功能集合，而是一套稳定、可识别的产品语言。", "sans body", "start").replace('class="sans body"', `class="sans body" fill="#D4DFEA"`)}
    ${text(98, 466, "安静", "sans section", "start").replace('class="sans section"', `class="sans section" fill="${palette.white}"`)}
    ${text(224, 466, "可信", "sans section", "start").replace('class="sans section"', `class="sans section" fill="${palette.white}"`)}
    ${text(350, 466, "城市", "sans section", "start").replace('class="sans section"', `class="sans section" fill="${palette.white}"`)}
    ${text(98, 506, "有人情味", "sans section", "start").replace('class="sans section"', `class="sans section" fill="${palette.white}"`)}
    ${line(98, 566, 470, 566, "#40546D")}
    ${text(98, 616, "视觉方向", "sans small", "start").replace('class="sans small"', `class="sans small" fill="${palette.amber}"`)}
    ${text(98, 652, "夜行纸页", "serif section", "start").replace('class="serif section"', `class="serif section" fill="${palette.white}"`)}
    ${text(98, 690, "雾白纸面 · 深墨蓝结构 · 路灯琥珀行动", "sans body", "start").replace('class="sans body"', `class="sans body" fill="#D4DFEA"`)}
    ${text(98, 742, "R01 · D01 · S01", "sans label", "start").replace('class="sans label"', `class="sans label" fill="#8FA5BC"`)}
    ${text(580, 126, "Product System / Candidate 01", "sans label ink")}
    ${text(580, 194, "同一种气质，", "serif title ink")}
    ${text(580, 240, "三种任务场景。", "serif title ink")}
    ${rounded(580, 306, 224, 152, 24, palette.passengerSoft)}
    ${circle(620, 348, 18, palette.passenger)}
    ${text(654, 354, "乘客", "sans section ink")}
    ${text(620, 398, "地图优先", "sans body ink")}
    ${text(620, 426, "行动自然", "sans body muted")}
    ${rounded(828, 306, 224, 152, 24, palette.ownerSoft)}
    ${circle(868, 348, 18, palette.owner)}
    ${text(902, 354, "车主", "sans section ink")}
    ${text(868, 398, "状态明确", "sans body ink")}
    ${text(868, 426, "效率克制", "sans body muted")}
    ${rounded(1076, 306, 224, 152, 24, palette.safetySoft)}
    ${circle(1116, 348, 18, palette.safety)}
    ${text(1150, 354, "联系", "sans section ink")}
    ${text(1116, 398, "上下文完整", "sans body ink")}
    ${text(1116, 426, "安全可达", "sans body muted")}
    ${rounded(580, 494, 720, 260, 28, palette.fog, palette.line, 1)}
    ${text(620, 542, "设计原则", "sans label ink")}
    ${text(620, 592, "01", "sans section", "start").replace('class="sans section"', `class="sans section" fill="${palette.amberDark}"`)}
    ${text(680, 592, "地图是场景，不是卡片背景", "sans body ink")}
    ${text(620, 640, "02", "sans section", "start").replace('class="sans section"', `class="sans section" fill="${palette.amberDark}"`)}
    ${text(680, 640, "每个首屏只突出一个主要行动", "sans body ink")}
    ${text(620, 688, "03", "sans section", "start").replace('class="sans section"', `class="sans section" fill="${palette.amberDark}"`)}
    ${text(680, 688, "异常态保持秩序，不破坏用户上下文", "sans body ink")}
  `);
}

function tokensBoard() {
  const swatches = [
    ["Ink 950", palette.ink, "结构 / 主要文字"],
    ["Paper 100", palette.fog, "页面背景"],
    ["Paper 50", palette.paper, "面板 / 输入"],
    ["Lamp 500", palette.amber, "主要行动"],
    ["Passenger 500", palette.passenger, "乘客身份"],
    ["Owner 500", palette.owner, "车主身份"],
    ["Safety 500", palette.safety, "安全阻断"],
    ["Mist 300", palette.line, "边界 / 禁用"],
  ];
  return svg(1440, 900, `
    ${rounded(0, 0, 1440, 900, 0, palette.fog)}
    ${text(64, 72, "01 · TOKENS", "sans label ink")}
    ${text(64, 124, "PollyCar 设计令牌", "serif title ink")}
    ${text(64, 160, "所有页面共享同一套颜色、字体、间距、尺寸和动效语义。", "sans body muted")}
    ${swatches.map(([name, color, desc], index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x = 64 + col * 326;
      const y = 218 + row * 172;
      return `${rounded(x, y, 294, 144, 22, palette.paper, palette.line, 1)}
        ${rounded(x + 16, y + 16, 88, 88, 18, color, color === palette.paper || color === palette.fog ? palette.line : "none", 1)}
        ${text(x + 122, y + 52, name, "sans body ink")}
        ${text(x + 122, y + 80, color, "sans small muted")}
        ${text(x + 122, y + 108, desc, "sans small muted")}`;
    }).join("")}
    ${rounded(64, 594, 628, 238, 28, palette.paper, palette.line, 1)}
    ${text(96, 638, "排版", "sans label ink")}
    ${text(96, 692, "页面标题 / 32", "serif title ink")}
    ${text(96, 734, "区域标题 / 22", "sans section ink")}
    ${text(96, 770, "正文 / 15 · 次级说明 / 12", "sans body muted")}
    ${rounded(724, 594, 652, 238, 28, palette.ink)}
    ${text(756, 638, "尺寸与节奏", "sans label", "start").replace('class="sans label"', `class="sans label" fill="${palette.amber}"`)}
    ${text(756, 686, "4", "sans section", "start").replace('class="sans section"', `class="sans section" fill="${palette.white}"`)}
    ${text(820, 686, "8", "sans section", "start").replace('class="sans section"', `class="sans section" fill="${palette.white}"`)}
    ${text(884, 686, "12", "sans section", "start").replace('class="sans section"', `class="sans section" fill="${palette.white}"`)}
    ${text(948, 686, "16", "sans section", "start").replace('class="sans section"', `class="sans section" fill="${palette.white}"`)}
    ${text(1012, 686, "20", "sans section", "start").replace('class="sans section"', `class="sans section" fill="${palette.white}"`)}
    ${text(1076, 686, "24", "sans section", "start").replace('class="sans section"', `class="sans section" fill="${palette.white}"`)}
    ${text(756, 738, "主按钮 56", "sans body", "start").replace('class="sans body"', `class="sans body" fill="#D4DFEA"`)}
    ${text(930, 738, "输入框 52", "sans body", "start").replace('class="sans body"', `class="sans body" fill="#D4DFEA"`)}
    ${text(1092, 738, "触摸目标 44", "sans body", "start").replace('class="sans body"', `class="sans body" fill="#D4DFEA"`)}
    ${text(756, 786, "动效 160 / 220 / 280ms", "sans body", "start").replace('class="sans body"', `class="sans body" fill="#D4DFEA"`)}
  `);
}

function componentsBoard() {
  return svg(1600, 1100, `
    ${rounded(0, 0, 1600, 1100, 0, palette.fog)}
    ${text(64, 72, "02 · SHARED COMPONENTS", "sans label ink")}
    ${text(64, 124, "统一组件，不是通用模板", "serif title ink")}
    ${text(64, 160, "组件共享视觉与行为契约，业务页面只改变语义。", "sans body muted")}
    ${rounded(64, 214, 460, 822, 30, palette.paper, palette.line, 1)}
    ${text(96, 258, "行动", "sans label ink")}
    ${rounded(96, 296, 396, 56, 16, palette.amber)}
    ${text(294, 332, "确认行程", "sans button ink", "middle")}
    ${rounded(96, 370, 396, 56, 16, palette.ink)}
    ${text(294, 406, "开始接单", "sans button", "middle").replace('class="sans button"', `class="sans button" fill="${palette.white}"`)}
    ${rounded(96, 444, 396, 56, 16, palette.paper, palette.line, 1)}
    ${text(294, 480, "稍后再说", "sans button ink", "middle")}
    ${rounded(96, 534, 396, 72, 18, palette.fog, palette.line, 1)}
    ${text(120, 562, "目的地", "sans small muted")}
    ${text(120, 590, "输入你要去的地方", "sans body ink")}
    ${rounded(96, 624, 396, 72, 18, palette.safetySoft, palette.safety, 1)}
    ${text(120, 652, "暂时无法继续", "sans small", "start").replace('class="sans small"', `class="sans small" fill="${palette.safety}"`)}
    ${text(120, 680, "请检查网络后重试", "sans body ink")}
    ${text(96, 752, "状态", "sans label ink")}
    ${rounded(96, 778, 108, 34, 17, palette.passengerSoft)}
    ${text(150, 800, "乘客", "sans small", "middle").replace('class="sans small"', `class="sans small" fill="${palette.passenger}"`)}
    ${rounded(216, 778, 108, 34, 17, palette.ownerSoft)}
    ${text(270, 800, "车主", "sans small", "middle").replace('class="sans small"', `class="sans small" fill="${palette.owner}"`)}
    ${rounded(336, 778, 132, 34, 17, palette.safetySoft)}
    ${text(402, 800, "需要处理", "sans small", "middle").replace('class="sans small"', `class="sans small" fill="${palette.safety}"`)}
    ${rounded(556, 214, 460, 822, 30, palette.paper, palette.line, 1)}
    ${text(588, 258, "地图与面板", "sans label ink")}
    ${rounded(588, 296, 396, 404, 24, "url(#mapPassenger)")}
    ${mapRoads(588, 296, 396, 404, palette.passenger)}
    ${rounded(588, 548, 396, 278, 28, palette.paper, "none", 0, 'filter="url(#softShadow)"')}
    ${rounded(754, 562, 64, 5, 3, palette.line)}
    ${text(620, 610, "你要去哪里？", "serif phone-title ink")}
    ${text(620, 640, "选择目的地，查看本次行程安排。", "sans phone-small muted")}
    ${rounded(620, 674, 332, 54, 16, palette.fog, palette.line, 1)}
    ${circle(646, 701, 8, palette.passenger)}
    ${text(668, 706, "人民广场", "sans phone-body ink")}
    ${rounded(620, 750, 332, 56, 16, palette.amber)}
    ${text(786, 786, "查看行程", "sans button ink", "middle")}
    ${text(588, 892, "固定底部面板", "sans body ink")}
    ${text(588, 922, "地图保持场景连续", "sans body muted")}
    ${text(588, 952, "首屏主行动始终可达", "sans body muted")}
    ${rounded(1048, 214, 488, 822, 30, palette.paper, palette.line, 1)}
    ${text(1080, 258, "联系与安全", "sans label ink")}
    ${rounded(1080, 298, 326, 80, 20, palette.fog)}
    ${circle(1118, 338, 22, palette.passenger)}
    ${text(1118, 344, "周", "sans body", "middle").replace('class="sans body"', `class="sans body" fill="${palette.white}"`)}
    ${text(1156, 328, "周师傅", "sans body ink")}
    ${text(1156, 352, "本次行程临时会话", "sans small muted")}
    ${rounded(1080, 418, 300, 86, 18, palette.fog)}
    ${text(1102, 452, "您好，我在西藏中路路口。", "sans body ink")}
    ${text(1102, 480, "09:40", "sans small muted")}
    ${rounded(1174, 526, 330, 92, 18, palette.amber)}
    ${text(1196, 562, "好的，我在 2 号门等您。", "sans body ink")}
    ${text(1196, 590, "09:40 · 已发送", "sans small ink")}
    ${rounded(1080, 662, 424, 72, 18, palette.safetySoft)}
    ${text(1104, 692, "联系仅用于本次行程", "sans small", "start").replace('class="sans small"', `class="sans small" fill="${palette.safety}"`)}
    ${text(1104, 718, "安全帮助始终可用", "sans body ink")}
    ${rounded(1080, 766, 424, 72, 18, palette.fog, palette.line, 1)}
    ${text(1104, 796, "24 小时", "sans body ink")}
    ${text(1190, 796, "遗失物品联系建议", "sans body muted")}
    ${text(1104, 824, "72 小时", "sans body ink")}
    ${text(1190, 824, "会话窗口", "sans body muted")}
  `);
}

function r01Board() {
  return phoneComparisonBoard({
    code: "03 · R01",
    title: "乘客首页",
    summary: "地图是视觉主体，底部面板只承载当前任务。",
    identity: "乘客",
    identityColor: palette.passenger,
    renderPhone: (frame) => phoneFrame({
      ...frame,
      name: frame.width < 430 ? "390 × 844" : "430 × 932",
      identity: "乘客",
      identityColor: palette.passenger,
      children: ({ x, y, width, height }) => `
        ${mapRoads(x, y, width, height * .64, palette.passenger)}
        ${rounded(x + 18, y + 26, 46, 46, 23, palette.paper, "none", 0, 'filter="url(#softShadow)"')}
        ${text(x + 41, y + 56, "P", "sans body ink", "middle")}
        ${rounded(x + width - 66, y + 26, 46, 46, 23, palette.paper, "none", 0, 'filter="url(#softShadow)"')}
        ${circle(x + width - 43, y + 49, 8, palette.passenger)}
        ${rounded(x, y + height * .57, width, height * .43, 30, palette.paper, "none", 0, 'filter="url(#shadow)"')}
        ${rounded(x + width / 2 - 32, y + height * .57 + 14, 64, 5, 3, palette.line)}
        ${text(x + 24, y + height * .57 + 64, "你要去哪里？", "serif phone-title ink")}
        ${text(x + 24, y + height * .57 + 92, "选择目的地，查看本次行程安排。", "sans phone-small muted")}
        ${rounded(x + 24, y + height * .57 + 118, width - 48, 56, 16, palette.fog, palette.line, 1)}
        ${circle(x + 50, y + height * .57 + 146, 8, palette.passenger)}
        ${text(x + 70, y + height * .57 + 151, "人民广场", "sans phone-body ink")}
        ${rounded(x + 24, y + height * .57 + 188, width - 48, 56, 16, palette.amber)}
        ${text(x + width / 2, y + height * .57 + 224, "查看行程", "sans button ink", "middle")}
        ${text(x + 24, y + height - 34, "地图、位置与时间保持在同一场景中", "sans phone-small muted")}
      `,
    }),
  });
}

function d01Board() {
  return phoneComparisonBoard({
    code: "04 · D01",
    title: "车主首页",
    summary: "状态优先，开始接单是唯一强调行动。",
    identity: "车主",
    identityColor: palette.owner,
    renderPhone: (frame) => phoneFrame({
      ...frame,
      name: frame.width < 430 ? "390 × 844" : "430 × 932",
      identity: "车主",
      identityColor: palette.owner,
      children: ({ x, y, width, height }) => `
        ${mapRoads(x, y, width, height * .62, palette.owner)}
        ${rounded(x + 18, y + 26, 134, 46, 23, palette.paper, "none", 0, 'filter="url(#softShadow)"')}
        ${circle(x + 42, y + 49, 10, palette.owner)}
        ${text(x + 62, y + 54, "车主模式", "sans phone-small ink")}
        ${rounded(x + width - 66, y + 26, 46, 46, 23, palette.paper, "none", 0, 'filter="url(#softShadow)"')}
        ${text(x + width - 43, y + 55, "•••", "sans body ink", "middle")}
        ${rounded(x, y + height * .55, width, height * .45, 30, palette.paper, "none", 0, 'filter="url(#shadow)"')}
        ${rounded(x + width / 2 - 32, y + height * .55 + 14, 64, 5, 3, palette.line)}
        ${text(x + 24, y + height * .55 + 62, "准备接单", "serif phone-title ink")}
        ${rounded(x + width - 126, y + height * .55 + 38, 102, 32, 16, palette.ownerSoft)}
        ${text(x + width - 75, y + height * .55 + 60, "当前下线", "sans phone-small", "middle").replace('class="sans phone-small"', `class="sans phone-small" fill="${palette.owner}"`)}
        ${text(x + 24, y + height * .55 + 94, "上线后浏览附近订单，每一单都由你决定。", "sans phone-small muted")}
        ${rounded(x + 24, y + height * .55 + 122, width - 48, 84, 18, palette.fog, palette.line, 1)}
        ${text(x + 48, y + height * .55 + 154, "今日状态", "sans phone-small muted")}
        ${text(x + 48, y + height * .55 + 184, "车辆与资格均已准备好", "sans phone-body ink")}
        ${rounded(x + 24, y + height * .55 + 224, width - 48, 56, 16, palette.ink)}
        ${text(x + width / 2, y + height * .55 + 260, "开始接单", "sans button", "middle").replace('class="sans button"', `class="sans button" fill="${palette.white}"`)}
        ${text(x + 24, y + height - 32, "点击后进入“正在上线”，完成后自动上线", "sans phone-small muted")}
      `,
    }),
  });
}

function s01Board() {
  return phoneComparisonBoard({
    code: "05 · S01",
    title: "行程联系",
    summary: "会话内容优先，安全和时间规则靠近对应任务。",
    identity: "联系",
    identityColor: palette.safety,
    renderPhone: (frame) => phoneFrame({
      ...frame,
      name: frame.width < 430 ? "390 × 844" : "430 × 932",
      identity: "联系",
      identityColor: palette.safety,
      children: ({ x, y, width, height }) => `
        ${rounded(x, y, width, height, 32, palette.fog)}
        ${rounded(x, y, width, 68, 0, palette.paper)}
        ${text(x + 24, y + 42, "‹", "serif section ink")}
        ${text(x + width / 2, y + 42, "行程联系", "sans phone-title ink", "middle")}
        ${rounded(x + 18, y + 84, width - 36, 74, 20, palette.paper)}
        ${circle(x + 50, y + 121, 22, palette.passenger)}
        ${text(x + 50, y + 127, "周", "sans body", "middle").replace('class="sans body"', `class="sans body" fill="${palette.white}"`)}
        ${text(x + 84, y + 114, "周师傅", "sans phone-body ink")}
        ${text(x + 84, y + 138, "本次行程临时会话", "sans phone-small muted")}
        ${rounded(x + width - 64, y + 98, 34, 34, 17, palette.safetySoft)}
        ${text(x + width - 47, y + 121, "!", "sans body", "middle").replace('class="sans body"', `class="sans body" fill="${palette.safety}"`)}
        ${rounded(x + 18, y + 170, width - 36, 66, 18, palette.ink)}
        ${text(x + 42, y + 198, "深宝灰 比亚迪汉 EV · 沪A·S1234", "sans phone-small", "start").replace('class="sans phone-small"', `class="sans phone-small" fill="${palette.white}"`)}
        ${text(x + 42, y + 220, "前往人民广场", "sans phone-small", "start").replace('class="sans phone-small"', `class="sans phone-small" fill="#D4DFEA"`)}
        ${rounded(x + 18, y + 250, width - 36, 78, 18, palette.paper, palette.line, 1)}
        ${text(x + 38, y + 280, "24 小时", "sans phone-small", "start").replace('class="sans phone-small"', `class="sans phone-small" fill="${palette.safety}"`)}
        ${text(x + 112, y + 280, "遗失物品联系建议", "sans phone-small muted")}
        ${text(x + 38, y + 310, "72 小时", "sans phone-small", "start").replace('class="sans phone-small"', `class="sans phone-small" fill="${palette.ink}"`)}
        ${text(x + 112, y + 310, "行程会话窗口", "sans phone-small muted")}
        ${text(x + width / 2, y + 366, "7月15日 09:39", "sans phone-small muted", "middle")}
        ${rounded(x + 18, y + 390, width * .67, 74, 18, palette.paper)}
        ${text(x + 38, y + 422, "您好，我在西藏中路路口。", "sans phone-body ink")}
        ${text(x + 38, y + 448, "09:40", "sans phone-small muted")}
        ${rounded(x + width * .24, y + 482, width * .71, 82, 18, palette.amber)}
        ${text(x + width * .24 + 20, y + 516, "好的，我在 2 号门等您。", "sans phone-body ink")}
        ${text(x + width * .24 + 20, y + 544, "09:40 · 已发送", "sans phone-small ink")}
        ${rounded(x + 18, y + height - 100, width - 84, 54, 18, palette.paper, palette.line, 1)}
        ${text(x + 38, y + height - 66, "输入消息", "sans phone-body muted")}
        ${circle(x + width - 40, y + height - 73, 27, palette.ink)}
        ${text(x + width - 40, y + height - 66, "↑", "sans section", "middle").replace('class="sans section"', `class="sans section" fill="${palette.white}"`)}
      `,
    }),
  });
}

function phoneComparisonBoard({ code, title, summary, renderPhone }) {
  return svg(1440, 1080, `
    ${rounded(0, 0, 1440, 1080, 0, "url(#nightPaper)")}
    ${text(64, 68, code, "sans label ink")}
    ${text(64, 118, title, "serif title ink")}
    ${text(64, 154, summary, "sans body muted")}
    ${rounded(64, 190, 1312, 826, 34, palette.paper, "none", 0, 'filter="url(#shadow)"')}
    ${renderPhone({ x: 160, y: 258, width: 390, height: 700 })}
    ${renderPhone({ x: 790, y: 224, width: 430, height: 734 })}
    ${line(650, 248, 650, 946, palette.line)}
    ${rounded(582, 544, 136, 44, 22, palette.fog, palette.line, 1)}
    ${text(650, 572, "同一套产品语言", "sans small ink", "middle")}
  `);
}

await Promise.all([
  ["00-cover.svg", coverBoard()],
  ["01-tokens.svg", tokensBoard()],
  ["02-components.svg", componentsBoard()],
  ["03-r01.svg", r01Board()],
  ["04-d01.svg", d01Board()],
  ["05-s01.svg", s01Board()],
].map(([name, content]) => writeFile(join(outputDir, name), content, "utf8")));

console.log(outputDir);

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
