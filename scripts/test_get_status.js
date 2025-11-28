// Directly call the reservation status function for testing
(async ()=>{
  try {
    const res = await fetch('http://localhost:3000/api/functions/get_reservation_status',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ customerName: '山田 太郎' })
    })
    console.log('status',res.status)
    const t = await res.text()
    console.log(t)
  } catch(e){console.error(e)}
})()
