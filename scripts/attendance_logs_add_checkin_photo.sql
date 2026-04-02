-- Run in MySQL / phpMyAdmin if check-in fails with missing column errors.
-- Error #1054 Unknown column 'checkin_photo' means use ADD, not MODIFY.

ALTER TABLE attendance_logs
  ADD COLUMN checkin_photo TEXT NULL COMMENT 'Cloudinary check-in image URL';

-- If the column already exists but is too short (e.g. VARCHAR(255)), use instead:
-- ALTER TABLE attendance_logs MODIFY COLUMN checkin_photo TEXT NULL;
