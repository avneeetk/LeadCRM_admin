export function downloadCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Get headers from the first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle values that might contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function prepareLeadsForExport(leads: any[]) {
  return leads.map(lead => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    source: lead.source,
    budget: lead.budget,
    status: lead.status,
    assigned_to: lead.assignedTo,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt || lead.createdAt,
  }));
}

export function prepareAttendanceForExport(attendance: any[]) {
  return attendance.map(record => ({
    user_id: record.userId,
    name: record.name,
    date: record.date,
    punch_in: record.punchIn,
    punch_out: record.punchOut || 'Not punched out',
    duration: record.duration || 'In progress',
    office_ip: record.officeIp || 'N/A',
  }));
}
