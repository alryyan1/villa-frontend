import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Popover, List, Typography, Empty, Spin, Tag, Divider } from 'antd';
import {
  BellOutlined, WarningOutlined, CalendarOutlined,
  ClockCircleOutlined, HomeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

const { Text } = Typography;

const SECTIONS = [
  {
    key: 'contracts_expired',
    label: 'Expired Contracts',
    icon: <WarningOutlined style={{ color: '#cf1322' }} />,
    tagColor: 'error',
    link: '/villas',
  },
  {
    key: 'contracts_expiring',
    label: 'Expiring Soon',
    icon: <WarningOutlined style={{ color: '#faad14' }} />,
    tagColor: 'warning',
    link: '/villas',
  },
  {
    key: 'checkins_today',
    label: "Today's Check-ins",
    icon: <CalendarOutlined style={{ color: '#1677ff' }} />,
    tagColor: 'processing',
    link: '/bookings',
  },
  {
    key: 'checkouts_today',
    label: "Today's Check-outs",
    icon: <ClockCircleOutlined style={{ color: '#722ed1' }} />,
    tagColor: 'purple',
    link: '/bookings',
  },
  {
    key: 'pending_bookings',
    label: 'Pending Bookings',
    icon: <HomeOutlined style={{ color: '#fa8c16' }} />,
    tagColor: 'orange',
    link: '/bookings',
  },
];

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-summary'],
    queryFn: () => client.get('/notifications/summary').then(r => r.data),
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const total = data?.total ?? 0;

  const content = (
    <div style={{ width: 340, maxHeight: 480, overflowY: 'auto' }}>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
      ) : total === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="All clear" style={{ padding: '16px 0' }} />
      ) : (
        SECTIONS.map((section, idx) => {
          const items = data?.[section.key] ?? [];
          if (!items.length) return null;
          return (
            <div key={section.key}>
              {idx > 0 && <Divider style={{ margin: '4px 0' }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 4px 4px' }}>
                {section.icon}
                <Text strong style={{ fontSize: 12 }}>{section.label}</Text>
                <Tag color={section.tagColor} style={{ marginLeft: 'auto', fontSize: 11 }}>{items.length}</Tag>
              </div>
              <List
                size="small"
                dataSource={items}
                renderItem={item => (
                  <List.Item
                    style={{ padding: '4px 4px', cursor: 'pointer' }}
                    onClick={() => { navigate(section.link); setOpen(false); }}
                  >
                    <div>
                      <Text style={{ fontSize: 12, display: 'block' }}>{item.label}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{item.detail}</Text>
                    </div>
                  </List.Item>
                )}
              />
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      title={<span style={{ fontSize: 13 }}>Notifications</span>}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
    >
      <Badge count={total} size="small" offset={[-2, 2]}>
        <BellOutlined
          style={{
            fontSize: 18,
            cursor: 'pointer',
            animation: total > 0 ? 'bellShake 2s ease-in-out infinite' : undefined,
          }}
        />
      </Badge>
    </Popover>
  );
}
