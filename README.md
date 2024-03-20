<div align="center">
    <h1>Request Crawler v0.1 (beta)</h1>
    <p>Web Application Endpoint Crawler</p>
</div>

<div align="center">
    <a href="https://nodejs.org/"><img src='https://img.shields.io/badge/node-18.15.0-blueviolet' alt="node"></a>
    <a href="https://pptr.dev/"><img src='https://img.shields.io/badge/puppeteer-21.3.8-brightgreen' alt="puppeteer"></a>
    <a href="https://github.com/marmelab/gremlins.js"><img src='https://img.shields.io/badge/gremlins-2.2.0-blue' alt="gremlins"></a>
</div>

## Introduction
这个crawler是向特定网站的特定页面发送请求，并保存在此过程中发生的请求的crawler。
这个crawler修正了Witcher Web Fuzzer的request crawler的错误，并添加了性能改进和新功能。

Ref : <a href="https://github.com/sefcom/Witcher/tree/master/base/helpers/request_crawler">Witcher's Request Crawler</a>

## Features
- [x] 登录后可以爬虫
- [x] 可优先追踪页面的endpoint
- [x] 可设置忽略爬虫的endpoint
- [x] 利用gremlins.js可通过随机事件进行爬虫

## Getting started
### 1. 크롤러 다운로드
```bash
$ git clone https://github.com/BoB-WebFuzzing/Request-Crawler.git
$ cd Request-Crawler
```
### 2. `package.json ` 安装依赖
```bash
$ npm install
```
### 3. config 설정
`Request-Crawler/src/witcher_config.json` 打开文件，输入要爬行的网站的信息。
```json
{
  "request_crawler": {
    "perform_login" : "Y",
    "login_url": "http://localhost/wp-login.php",
    "usernameSelector": "#user_login",
    "usernameValue": "testId",
    "passwordSelector": "#user_pass",
    "passwordValue": "testPw",
    "submitType": "enter",
    "positiveLoginMessage": "프로필",
    "method": "POST",
    "form_submit_selector": "",
    "ignoreValues": [],
    "urlUniqueIfValueUnique": [],
    "endpoints": [
      "admin.php?page=test1",
      "admin.php?page=test2",
      "admin.php?page=test3"
    ],
    "ignoreEndpoints": [
      "index.php",
      "upload.php",
      "media-new.php",
      "profile.php",
      "export-personal-data.php",
      "erase-personal-data.php",
      "options-general.php",
      "options-writing.php",
      "options-reading.php",
      "options-discussion.php",
      "options-media.php",
      "options-permalink.php",
      "options-privacy.php"
    ]
  }
}
```
- `perform_login`: 决定是否执行登录。设定为Y`或`N`。
- `login_url`: 输入要执行登录的页面的地址。
- `usernameSelector`: 在登录页面中输入input标签的selector输入用户名。
- `usernameValue`: 在登录页面输入要输入的id。
- `passwordSelector`:在登录页面中输入输入密码的input标签的selector。
- `passwordValue`: 在登录页面输入要输入的密码。
- `submitType`: 在登录页面上决定如何执行登录。设置为enter`或click`或submit`。
- `positiveLoginMessage`: 输入一条信息，以确认登录是否成功。
- `method`: 输入发送登录请求时使用的HTTP方法。
- `form_submit_selector`: (选择)在登录页面中输入执行登录的按钮的selector。
- `endpoints`: (选择)首先输入要爬行的页面的endpoint。
- `ignoreEndpoints`: (选择)在滚动时输入要忽略的endpoint。不滚动包含相应endpoint的页面。
### 4. 크롤러 실행
```bash
$ cd src
$ node main.js <target_site> [--no-headless]
```
- `target_site`: 要跟踪的网站地址
- `--no-headless`: 当你想看到爬虫过程时使用
### 5. 确认爬虫结果
- `Request-Crawler/src/ouput` 在文件夹` request _ data。滚动结果将以json`文件名保存。
- `Request-Crawler/src/ouput/screenshots` 文件夹将保存登录过程中截图。

## 参考
- 目前是beta版本，爬行过程中可能会发生意想不到的错误。在这种情况下，请将错误记录登录到issue，我们将非常感谢。

## TODO
- [ ] 暂停及重启爬虫功能
- [ ] 如果收集的URL参数的值不同，可以识别为不同的URL
