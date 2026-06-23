# Sewon Sign Manager v2.2

법정 의무교육 전자서명 관리 프로그램입니다.

## 주요 변경사항

- 관리자 기본 계정과 기본 비밀번호를 코드에서 제거했습니다.
- 관리자 로그인은 Supabase Authentication 계정으로 처리합니다.
- Supabase `admin_users` 테이블에 등록된 계정만 관리자 화면에 접속할 수 있습니다.
- 직원 기본 리스트, 교육 기본 데이터, 관리자 기본값은 포함하지 않습니다.
- 직원 업로드 양식은 빈 양식만 다운로드됩니다.

## 관리자 계정 등록 방법

1. Supabase Dashboard → Authentication → Users에서 관리자 이메일 계정을 생성합니다.
2. 생성된 사용자의 User UID를 복사합니다.
3. SQL Editor에서 아래 형식으로 관리자 권한을 부여합니다.

```sql
insert into admin_users (auth_user_id, email, name, role, is_active)
values ('복사한_USER_UID', '관리자이메일', '관리자명', 'admin', true);
```

## 실행/배포

Vercel 환경변수와 Supabase 테이블이 준비된 상태에서 배포하면 됩니다.


## v2.2 변경사항

- 관리자 기본 ID/PW 하드코딩 제거 상태 유지
- Supabase Auth + admin_users 권한 테이블 기반 관리자 로그인
- 직원/교육 기본 데이터 없음
- Vercel 환경변수 값에 공백/줄바꿈이 포함되어도 trim 처리
