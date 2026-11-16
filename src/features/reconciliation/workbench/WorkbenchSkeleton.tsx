import { Skeleton } from '@/components/States'
import pageStyles from './WorkbenchPage.module.css'
import paneStyles from './Pane.module.css'

export function WorkbenchSkeleton() {
  return (
    <div className={pageStyles.page}>
      <div>
        <Skeleton width="min(260px, 70%)" height={26} />
        <div style={{ height: 8 }} />
        <Skeleton width="min(360px, 100%)" />
      </div>
      <div className={pageStyles.overview}>
        <Skeleton height={110} />
        <Skeleton height={110} />
      </div>
      <Skeleton height={64} />
      <div className={pageStyles.panes}>
        {[8, 6].map((rows, pane) => (
          <div key={pane} className={paneStyles.pane}>
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} style={{ padding: '14px 16px' }}>
                <Skeleton height={36} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
