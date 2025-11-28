// Directly call the function endpoint for testing
(async ()=>{
  try {
    const res = await fetch('http://localhost:3000/api/functions/create_reservation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: 'loc1', startDate: '2025-09-20T10:00:00+09:00', endDate: '2025-09-22T18:00:00+09:00', customerName: '山田 太郎' })
    })
    console.log('status', res.status)
    const text = await res.text()
    console.log(text)
  } catch (e) {
    console.error('err', e)
  }
})()
