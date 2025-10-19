#!/bin/bash

# Chrome插件自动刷新脚本 (macOS)
# 使用方法: 双击运行或在终端中执行 ./refresh-extension.sh

echo "🔄 Chrome插件自动刷新脚本"
echo "================================"

# 获取当前脚本所在目录
PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "📁 插件目录: $PLUGIN_DIR"

# 检查插件目录是否存在
if [ ! -d "$PLUGIN_DIR" ]; then
    echo "❌ 插件目录不存在: $PLUGIN_DIR"
    read -p "按任意键退出..."
    exit 1
fi

# 检查必要文件是否存在
REQUIRED_FILES=("manifest.json" "popup.html" "popup.js" "popup.css" "content.js" "feishu-api.js" "storage.js")
echo ""
echo "🔍 检查必要文件..."

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$PLUGIN_DIR/$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file (缺失)"
        MISSING_FILES=true
    fi
done

if [ "$MISSING_FILES" = true ]; then
    echo ""
    echo "⚠️  检测到缺失文件，请确保所有文件都已创建"
    read -p "按任意键退出..."
    exit 1
fi

echo ""
echo "🔧 查找Chrome应用程序..."

# 查找Chrome应用程序路径
CHROME_PATHS=(
    "/Applications/Google Chrome.app"
    "/Applications/Chromium.app"
    "$HOME/Applications/Google Chrome.app"
)

CHROME_PATH=""
for path in "${CHROME_PATHS[@]}"; do
    if [ -d "$path" ]; then
        CHROME_PATH="$path"
        echo "✅ 找到Chrome: $path"
        break
    fi
done

if [ -z "$CHROME_PATH" ]; then
    echo "❌ 未找到Chrome浏览器"
    echo "请确保已安装Google Chrome"
    read -p "按任意键退出..."
    exit 1
fi

echo ""
echo "🔄 刷新Chrome插件..."

# 使用AppleScript刷新插件
osascript <<EOF
tell application "Google Chrome"
    activate
    delay 1

    -- 打开扩展程序页面
    set theURL to "chrome://extensions/"
    set tabIndex to 0

    -- 查找现有的扩展程序页面
    repeat with w in windows
        repeat with t in tabs of w
            if URL of t contains "chrome://extensions/" then
                set tabIndex to index of t
                set active tab index of w to tabIndex
                set index of w to 1
                exit repeat
            end if
        end repeat
    end repeat

    -- 如果没找到扩展程序页面，则打开新的
    if tabIndex is 0 then
        make new window with properties {URL: theURL}
    end if

    delay 2

    -- 模拟点击刷新按钮
    tell application "System Events"
        tell process "Google Chrome"
            keystroke "r" using command down
            delay 1
        end tell
    end tell
end tell
EOF

echo ""
echo "✅ 插件刷新完成！"
echo ""
echo "📝 使用说明:"
echo "1. 确保已在Chrome中启用开发者模式"
echo "2. 如果是首次安装，请点击'加载已解压的扩展程序'"
echo "3. 选择插件目录: $PLUGIN_DIR"
echo "4. 插件会自动刷新，无需重启浏览器"
echo ""
echo "💡 提示: 以后修改代码后，直接双击此脚本即可刷新插件"

# 检查开发者模式提示
echo ""
echo "🔍 检查开发者模式状态..."
osascript <<EOF
tell application "Google Chrome"
    activate
    delay 1

    -- 打开扩展程序页面检查开发者模式
    set theURL to "chrome://extensions/"
    make new window with properties {URL: theURL}
    delay 2
end tell
EOF

echo ""
echo "📋 请检查Chrome扩展程序页面是否已开启'开发者模式'"
echo "📍 开发者模式开关位于页面右上角"
echo ""
read -p "按任意键退出..."