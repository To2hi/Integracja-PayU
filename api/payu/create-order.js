
export default function hendler(res, req) {
  if (req.method === "POST")
  {
  const body = req.body;
    res.status(200).json({ string: body.string || null});
  }else 
  {
    re.status(200).json({ string: null});
    
  }


  
}

export default function handler(req, res) {
  if (req.method === "POST") {
    const body = req.body;
    res.status(200).json({ string: body.string || null });
  } else {
    res.status(200).json({ string: null });
  }
}
