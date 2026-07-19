-- improvement_issues.status に 'postponed' を追加(admin UIの「保留」アクション用)。
alter table improvement_issues drop constraint improvement_issues_status_check;
alter table improvement_issues add constraint improvement_issues_status_check check (status in (
  'detected', 'investigated', 'proposal_ready', 'approved', 'implementing',
  'draft_pr', 'testing', 'ready_for_review', 'deployed', 'measuring',
  'successful', 'failed', 'rolled_back', 'rejected', 'insufficient_data', 'postponed'
));
