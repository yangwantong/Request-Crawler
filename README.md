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
이 크롤러는 특정 웹사이트의 특정 페이지에 대한 요청을 보내고, 그 과정에서 발생한 요청을 저장하는 크롤러입니다.
이 크롤러는 Witcher Web Fuzzer의 request crawler의 오류를 수정하고 성능 개선 및 새로운 기능을 추가한 버전입니다.

Ref : <a href="https://github.com/sefcom/Witcher/tree/master/base/helpers/request_crawler">Witcher's Request Crawler</a>

## Features
- [x] 로그인을 수행한 후 크롤링 가능
- [x] 크롤링 할 페이지의 endpoint를 우선적으로 크롤링 가능
- [x] 크롤링 할 때 무시할 endpoint 설정 가능
- [x] gremlins.js 를 이용하여 랜덤한 이벤트 발생을 통한 크롤링 가능

## Getting started
### 1. 크롤러 다운로드
```bash
$ git clone https://github.com/BoB-WebFuzzing/Request-Crawler.git
$ cd Request-Crawler
```
### 2. `package.json ` 의존성 설치
```bash
$ npm install
```
### 3. config 설정
`Request-Crawler/src/witcher_config.json` 파일을 열어서 크롤링 할 사이트의 정보를 입력합니다.
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
- `perform_login`: 로그인을 수행할지 여부를 결정합니다. `Y` 또는 `N`으로 설정합니다.
- `login_url`: 로그인을 수행할 페이지의 주소를 입력합니다.
- `usernameSelector`: 로그인 페이지에서 아이디를 입력하는 input 태그의 selector를 입력합니다.
- `usernameValue`: 로그인 페이지에서 입력할 아이디를 입력합니다.
- `passwordSelector`: 로그인 페이지에서 비밀번호를 입력하는 input 태그의 selector를 입력합니다.
- `passwordValue`: 로그인 페이지에서 입력할 비밀번호를 입력합니다.
- `submitType`: 로그인 페이지에서 로그인을 수행하는 방법을 결정합니다. `enter` 또는 `click` 또는 `submit` 으로 설정합니다.
- `positiveLoginMessage`: 로그인이 성공했는지 확인할 수 있는 메시지를 입력합니다.
- `method`: 로그인 요청을 보낼 때 사용할 HTTP 메소드를 입력합니다.
- `form_submit_selector`: (선택) 로그인 페이지에서 로그인을 수행하는 버튼의 selector를 입력합니다.
- `endpoints`: (선택) 우선적으로 크롤링 할 페이지의 endpoint를 입력합니다.
- `ignoreEndpoints`: (선택) 크롤링 할 때 무시할 endpoint를 입력합니다. 해당 endpoint가 포함된 페이지는 크롤링하지 않습니다.
### 4. 크롤러 실행
```bash
$ cd src
$ node main.js <target_site> [--no-headless]
```
- `target_site`: 크롤링 할 사이트의 주소
- `--no-headless`: 크롤링 과정을 눈으로 확인하고 싶을 때 사용
### 5. 크롤링 결과 확인
- `Request-Crawler/src/ouput` 폴더에 `request_data.json` 파일명으로 크롤링 결과가 저장됩니다.
- `Request-Crawler/src/ouput/screenshots` 폴더에는 로그인 과정에서 캡쳐한 스크린샷이 저장됩니다.

## 참고사항
- 현재 beta 버전이므로 크롤링 도중 예기치 못한 오류가 발생할 수 있습니다. 이 경우 오류 내역을 `issue`에 등록해주시면 감사하겠습니다.

## TODO
- [ ] 크롤링 일시정지 및 재개 기능
- [ ] 수집한 URL의 파라미터의 값이 다르면 다른 URL로 인식하는 문제 개선