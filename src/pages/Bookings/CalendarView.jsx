import { useState, useMemo } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Modal, Descriptions, Tag } from 'antd';
import dayjs from 'dayjs';

const localizer = momentLocalizer(moment);

const statusColors = { confirmed: '#52c41a', pending: '#faad14', cancelled: '#ff4d4f', completed: '#1677ff' };
const statusLabels = { confirmed: 'Confirmed', pending: 'Pending', cancelled: 'Cancelled', completed: 'Completed' };

const messages = {
  today: 'Today', previous: 'Back', next: 'Next',
  month: 'Month', week: 'Week', day: 'Day', agenda: 'Agenda',
  noEventsInRange: 'No bookings in this range.',
};

export default function BookingCalendar({ bookings }) {
  const [selected, setSelected] = useState(null);

  const events = useMemo(() =>
    (bookings || [])
      .filter(b => b.status !== 'cancelled')
      .map(b => ({
        id:       b.id,
        title:    `${b.villa?.name} — ${b.guest?.name}`,
        start:    new Date(b.check_in),
        end:      new Date(b.check_out),
        resource: b,
        color:    statusColors[b.status],
      })),
  [bookings]);

  const eventPropGetter = (event) => ({
    style: { backgroundColor: event.color, borderColor: event.color, color: '#fff' },
  });

  return (
    <>
      <div style={{ height: 600 }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          eventPropGetter={eventPropGetter}
          messages={messages}
          onSelectEvent={(e) => setSelected(e.resource)}
        />
      </div>

      <Modal
        open={!!selected}
        onCancel={() => setSelected(null)}
        footer={null}
        title={`Booking #${selected?.id}`}
      >
        {selected && (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Villa">{selected.villa?.name}</Descriptions.Item>
            <Descriptions.Item label="Guest">{selected.guest?.name}</Descriptions.Item>
            <Descriptions.Item label="Phone">{selected.guest?.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="Check In">{dayjs(selected.check_in).format('YYYY-MM-DD')}</Descriptions.Item>
            <Descriptions.Item label="Check Out">{dayjs(selected.check_out).format('YYYY-MM-DD')}</Descriptions.Item>
            <Descriptions.Item label="Nights">{selected.nights}</Descriptions.Item>
            <Descriptions.Item label="Total">OMR {Number(selected.total_amount).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={statusColors[selected.status]}>{statusLabels[selected.status]}</Tag>
            </Descriptions.Item>
            {selected.notes && <Descriptions.Item label="Notes">{selected.notes}</Descriptions.Item>}
          </Descriptions>
        )}
      </Modal>
    </>
  );
}
