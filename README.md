# Global Time Zone

Chrome 扩展：显示多个时区时间，支持夏令时自动切换，并能将选中主时区时间直接显示在浏览器插件图标上。

## 功能

- 多时区列表展示
- 自动夏令时（DST）识别
- 深色现代 UI
- 可配置时区名称与排序
- 主时区时间显示在插件图标上
- 点击某个时区可以直接跳转到 `timeanddate.com` 对应城市页面

## 文件说明

- `manifest.json`：Chrome 扩展清单
- `popup.html`、`popup.js`：插件弹窗 UI
- `options.html`、`options.js`：时区配置页面
- `background.js`：后台服务工作器，更新图标显示及定时刷新
- `timezones.js`：时区列表及 `timeanddate.com` 映射
- `icons/`：插件图标资源

## 安装

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择当前仓库目录 `GlobalTimeZone`

## 使用

- 点击插件图标，打开时区列表
- 可通过“设置”按钮进入配置页面
- 在配置页面添加、删除、排序时区，并设置主显示时区
- 点击弹窗中的某个时区行，直接跳转到对应的 `timeanddate.com` 页面

## 推送说明

已将所有修改推送到 `https://github.com/Jarrey/GlobalTimeZone` 的 `main` 分支。
