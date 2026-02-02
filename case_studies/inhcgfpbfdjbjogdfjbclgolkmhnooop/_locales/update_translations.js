const fs = require('fs');
const path = require('path');

// Object containing all translations
const translations = {
  "en": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Chat with DeepSeek AI – Boost your creativity and productivity using DeepSeek R!, the ultimate AI-powered browser tool."
    }
  },
  "fr": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Discutez avec DeepSeek AI – Stimulez votre créativité et productivité avec DeepSeek R!, l'outil de navigation ultime propulsé par l'IA."
    }
  },
  "es": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Chatea con DeepSeek AI – Potencia tu creatividad y productividad usando DeepSeek R!, la herramienta definitiva para navegadores impulsada por IA."
    }
  },
  "de": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Chatte mit DeepSeek AI – Steigere deine Kreativität und Produktivität mit DeepSeek R!, dem ultimativen KI-gestützten Browser-Tool."
    }
  },
  "it": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Chatta con DeepSeek AI – Potenzia la tua creatività e produttività utilizzando DeepSeek R!, lo strumento definitivo per browser basato sull'intelligenza artificiale."
    }
  },
  "ja": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "DeepSeek AIとチャット – DeepSeek R!を使用して創造性と生産性を高めましょう。AIを活用した究極のブラウザツールです。"
    }
  },
  "zh": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "与DeepSeek AI聊天 – 使用DeepSeek R!提升您的创造力和生产力，这是一款由人工智能驱动的终极浏览器工具。"
    }
  },
  "ko": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "DeepSeek AI와 채팅하세요 – DeepSeek R!을 사용하여 창의성과 생산성을 향상시키세요. 최고의 AI 기반 브라우저 도구입니다."
    }
  },
  "pt": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Converse com DeepSeek AI – Aumente sua criatividade e produtividade usando DeepSeek R!, a ferramenta definitiva para navegadores com tecnologia de IA."
    }
  },
  "ru": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Общайтесь с DeepSeek AI – Повысьте свою креативность и продуктивность с помощью DeepSeek R!, лучшего инструмента для браузера на базе искусственного интеллекта."
    }
  },
  "nl": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Chat met DeepSeek AI – Vergroot je creativiteit en productiviteit met DeepSeek R!, de ultieme AI-gestuurde browserextensie."
    }
  },
  "sv": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Chatta med DeepSeek AI – Öka din kreativitet och produktivitet med DeepSeek R!, det ultimata AI-drivna webbläsarverktyget."
    }
  },
  "fi": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Keskustele DeepSeek AI:n kanssa – Tehosta luovuuttasi ja tuottavuuttasi DeepSeek R!:n avulla, täydellisellä tekoälypohjaisella selaintyökalulla."
    }
  },
  "da": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Chat med DeepSeek AI – Boost din kreativitet og produktivitet med DeepSeek R!, det ultimative AI-drevne browserværktøj."
    }
  },
  "no": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Chat med DeepSeek AI – Øk kreativiteten og produktiviteten din med DeepSeek R!, det ultimate KI-drevne nettleserverktøyet."
    }
  },
  "pl": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Rozmawiaj z DeepSeek AI – Zwiększ swoją kreatywność i produktywność dzięki DeepSeek R!, najlepszemu narzędziu przeglądarkowemu opartemu na sztucznej inteligencji."
    }
  },
  "tr": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "DeepSeek AI ile sohbet edin – DeepSeek R! ile yaratıcılığınızı ve üretkenliğinizi artırın, yapay zeka destekli en iyi tarayıcı aracı."
    }
  },
  "ar": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "تحدث مع DeepSeek AI – عزز إبداعك وإنتاجيتك باستخدام DeepSeek R!، الأداة المتطورة للمتصفح المدعومة بالذكاء الاصطناعي."
    }
  },
  "hi": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "DeepSeek AI के साथ चैट करें – DeepSeek R! का उपयोग करके अपनी रचनात्मकता और उत्पादकता बढ़ाएं, यह एआई-संचालित अंतिम ब्राउज़र टूल है।"
    }
  },
  "th": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "แชทกับ DeepSeek AI – เพิ่มความคิดสร้างสรรค์และประสิทธิภาพของคุณด้วย DeepSeek R! เครื่องมือเบราว์เซอร์ที่ขับเคลื่อนด้วย AI ที่ดีที่สุด"
    }
  },
  "id": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Mengobrol dengan DeepSeek AI – Tingkatkan kreativitas dan produktivitas Anda menggunakan DeepSeek R!, alat browser terbaik yang didukung kecerdasan buatan."
    }
  },
  "vi": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Trò chuyện với DeepSeek AI – Tăng cường sáng tạo và năng suất của bạn bằng DeepSeek R!, công cụ trình duyệt tối ưu được hỗ trợ bởi trí tuệ nhân tạo."
    }
  },
  "cs": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Chatujte s DeepSeek AI – Zvyšte svou kreativitu a produktivitu pomocí DeepSeek R!, dokonalého nástroje pro prohlížeč s umělou inteligencí."
    }
  },
  "hu": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Csevegjen a DeepSeek AI-val – Növelje kreativitását és termelékenységét a DeepSeek R! segítségével, a legjobb mesterséges intelligenciával működő böngészőeszközzel."
    }
  },
  "el": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Συνομιλήστε με το DeepSeek AI – Ενισχύστε τη δημιουργικότητα και την παραγωγικότητά σας χρησιμοποιώντας το DeepSeek R!, το απόλυτο εργαλείο περιήγησης με τεχνητή νοημοσύνη."
    }
  },
  "he": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "שוחח עם DeepSeek AI – הגבר את היצירתיות והפרודוקטיביות שלך באמצעות DeepSeek R!, כלי הדפדפן האולטימטיבי המופעל על ידי בינה מלאכותית."
    }
  },
  "ro": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Conversați cu DeepSeek AI – Stimulați-vă creativitatea și productivitatea folosind DeepSeek R!, instrumentul suprem pentru browser bazat pe inteligență artificială."
    }
  },
  "uk": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Спілкуйтеся з DeepSeek AI – Підвищіть свою креативність та продуктивність за допомогою DeepSeek R!, найкращого інструменту для браузера на основі штучного інтелекту."
    }
  },
  "bg": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Чатете с DeepSeek AI – Увеличете вашата креативност и продуктивност с помощта на DeepSeek R!, най-добрият инструмент за браузър, базиран на изкуствен интелект."
    }
  },
  "sk": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Chatujte s DeepSeek AI – Zvýšte svoju kreativitu a produktivitu pomocou DeepSeek R!, dokonalého prehliadačového nástroja s umelou inteligenciou."
    }
  },
  "hr": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Razgovarajte s DeepSeek AI – Povećajte svoju kreativnost i produktivnost koristeći DeepSeek R!, vrhunski alat za preglednik pokretan umjetnom inteligencijom."
    }
  },
  "sr": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Ćaskajte sa DeepSeek AI – Unapredite svoju kreativnost i produktivnost koristeći DeepSeek R!, vrhunski alat za pretraživač zasnovan na veštačkoj inteligenciji."
    }
  },
  "sl": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Klepetajte z DeepSeek AI – Povečajte svojo ustvarjalnost in produktivnost z uporabo DeepSeek R!, najboljšega orodja za brskalnik, ki ga poganja umetna inteligenca."
    }
  },
  "et": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Vestle DeepSeek AI-ga – Suurenda oma loovust ja produktiivsust DeepSeek R!-i abil, mis on parim tehisintellektil põhinev brauseritööriist."
    }
  },
  "lv": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Tērzējiet ar DeepSeek AI – Uzlabojiet savu radošumu un produktivitāti, izmantojot DeepSeek R!, izcilāko mākslīgā intelekta pārlūkprogrammas rīku."
    }
  },
  "lt": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Bendraukite su DeepSeek AI – Padidinkite savo kūrybiškumą ir produktyvumą naudodami DeepSeek R!, pažangiausią dirbtinio intelekto naršyklės įrankį."
    }
  },
  "mk": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Разговарајте со DeepSeek AI – Зголемете ја вашата креативност и продуктивност со користење на DeepSeek R!, врвната алатка за прелистувач поддржана од вештачка интелигенција."
    }
  },
  "ms": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Berbual dengan DeepSeek AI – Tingkatkan kreativiti dan produktiviti anda menggunakan DeepSeek R!, alat pelayar terbaik yang dikuasakan oleh kecerdasan buatan."
    }
  },
  "fa": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "با DeepSeek AI گفتگو کنید – خلاقیت و بهره‌وری خود را با استفاده از DeepSeek R!، برترین ابزار مرورگر مبتنی بر هوش مصنوعی، افزایش دهید."
    }
  },
  "ca": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Xateja amb DeepSeek AI – Potencia la teva creativitat i productivitat utilizando DeepSeek R!, l'eina definitiva per a navegadors impulsada per intel·ligència artificial."
    }
  },
  "eu": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Txateatu DeepSeek AI-rekin – Handitu zure sormena eta produktibitatea DeepSeek R! erabiliz, adimen artifizialak bultzatutako nabigatzailearen tresna bikainena."
    }
  },
  "gl": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Conversa con DeepSeek AI – Aumenta a túa creatividade e produtividade usando DeepSeek R!, a ferramenta definitiva para navegadores impulsada por intelixencia artificial."
    }
  },
  "is": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Spjallaðu við DeepSeek AI – Auktu sköpunargáfu þína og framleiðni með DeepSeek R!, fullkomnasta gervigreindarknúna vafratækinu."
    }
  },
  "bn": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "DeepSeek AI এর সাথে চ্যাট করুন – DeepSeek R! ব্যবহার করে আপনার সৃজনশীলতা এবং উৎপাদনশীলতা বাড়ান, এআই চালিত চূড়ান্ত ব্রাউজার টুল।"
    }
  },
  "ta": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "DeepSeek AI உடன் அரட்டையடியுங்கள் – DeepSeek R! பயன்படுத்தி உங்கள் படைப்பாற்றலையும் உற்பத்தித்திறனையும் அதிகரிக்கவும், செயற்கை நுண்ணறிவால் இயக்கப்படும் சிறந்த உலாவி கருவி."
    }
  },
  "te": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "DeepSeek AI తో చాట్ చేయండి – DeepSeek R! ఉపయోగించి మీ సృజనాత్మకత మరియు ఉత్పాదకతను పెంచుకోండి, కృత్రిమ మేధస్సుతో నడిచే అత్యుత్తమ బ్రౌజర్ సాధనం."
    }
  },
  "ml": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "DeepSeek AI-യുമായി ചാറ്റ് ചെയ്യുക – DeepSeek R! ഉപയോഗിച്ച് നിങ്ങളുടെ സർഗാത്മകതയും ഉൽപാദനക്ഷമതയും വർദ്ധിപ്പിക്കുക, കൃത്രിമബുദ്ധി പ്രവർത്തിപ്പിക്കുന്ന മികച്ച ബ്രൗസർ ടൂൾ."
    }
  },
  "kn": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "DeepSeek AI ನೊಂದಿಗೆ ಚಾಟ್ ಮಾಡಿ – DeepSeek R! ಬಳಸಿ ನಿಮ್ಮ ಸೃಜನಶೀಲತೆ ಮತ್ತು ಉತ್ಪಾದಕತೆಯನ್ನು ಹೆಚ್ಚಿಸಿ, ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆಯಿಂದ ಚಾಲಿತವಾದ ಅತ್ಯುತ್ತಮ ಬ್ರೌಸರ್ ಟೂಲ್."
    }
  },
  "mr": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "DeepSeek AI सोबत चॅट करा – DeepSeek R! वापरून तुमची सर्जनशीलता आणि उत्पादकता वाढवा, कृत्रिम बुद्धिमत्तेने चालवलेले सर्वोत्तम ब्राउझर टूल."
    }
  },
  "gu": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "DeepSeek AI સાથે ચેટ કરો – DeepSeek R! નો ઉપયોગ કરીને તમારી સર્જનાત્મકતા અને ઉત્પાદકતા વધારો, કૃત્રિમ બુદ્ધિમત્તા દ્વારા સંચાલિત શ્રેષ્ઠ બ્રાઉઝર ટૂલ."
    }
  },
  "si": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "DeepSeek AI සමඟ කතාබස් කරන්න – DeepSeek R! භාවිතයෙන් ඔබේ නිර්මාණශීලීත්වය සහ ඵලදායීතාව වැඩි දියුණු කරගන්න, කෘතිම බුද්ධිය මගින් ක්‍රියාත්මක වන අති විශිෂ්ට බ්‍රවුසර මෙවලම."
    }
  },
  "az": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "DeepSeek AI ilə söhbət edin – DeepSeek R! istifadə edərək yaradıcılığınızı və məhsuldarlığınızı artırın, süni intellekt tərəfindən idarə olunan ən mükəmməl brauzer aləti."
    }
  },
  "hy": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Զրուցեք DeepSeek AI-ի հետ – Բարձրացրեք ձեր ստեղծագործականությունը և արդյունավետությունը օգտագործելով DeepSeek R!-ը, արհեստական բանականությամբ աշխատող լավագույն բրաուզերի գործիքը։"
    }
  },
  "ka": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "ისაუბრეთ DeepSeek AI-სთან – გაზარდეთ თქვენი კრეატიულობა და პროდუქტიულობა DeepSeek R!-ის გამოყენებით, ხელოვნური ინტელექტით მართული საუკეთესო ბრაუზერის ინსტრუმენტი."
    }
  },
  "ur": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "DeepSeek AI کے ساتھ چیٹ کریں – DeepSeek R! کا استعمال کرکے اپنی تخلیقی صلاحیت اور پیداواری صلاحیت کو بڑھائیں، مصنوعی ذہانت سے چلنے والا بہترین براؤزر ٹول۔"
    }
  },
  "af": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Gesels met DeepSeek AI – Verhoog jou kreatiwiteit en produktiwiteit deur DeepSeek R! te gebruik, die uiterste kunsmatige intelligensie-aangedrewe blaaiergereedskap."
    }
  },
  "sw": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "Ongea na DeepSeek AI – Ongeza ubunifu na tija yako kwa kutumia DeepSeek R!, zana bora ya kivinjari inayoendeshwa na akili bandia."
    }
  },
  "am": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "ከ DeepSeek AI ጋር ይወያዩ – DeepSeek R!ን በመጠቀም የእርስዎን ፈጠራዊነት እና ምርታማነት ያሳድጉ፣ በሰው ሰራሽ አእምሮ የሚሰራ ከፍተኛው የአሳሽ መሳሪያ።"
    }
  },
  "mn": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "DeepSeek AI-тай чатлах – DeepSeek R! ашиглан өөрийн бүтээлч чадвар болон бүтээмжээ нэмэгдүүлээрэй, хиймэл оюун ухаанаар ажилладаг хамгийн шилдэг хөтөч хэрэгсэл."
    }
  },
  "ne": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "DeepSeek AI संग कुराकानी गर्नुहोस् – DeepSeek R! प्रयोग गरेर आफ्नो सिर्जनात्मकता र उत्पादकता बढाउनुहोस्, कृत्रिम बुद्धिमत्ताद्वारा संचालित उत्कृष्ट ब्राउजर उपकरण।"
    }
  },
  "km": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "ជជែកជាមួយ DeepSeek AI – បង្កើនភាពច្នៃប្រឌិត និងផលិតភាពរបស់អ្នកដោយប្រើ DeepSeek R! ឧបករណ៍កម្មវិធីរុករកដ៏អស្ចារ្យដែលដំណើរការដោយបញ្ញាសិប្បនិម្មិត។"
    }
  },
  "lo": {
    "extName": {
      "message": "DeepSeek AI"
    },
    "extShortDesc": {
      "message": "ສົນທະນາກັບ DeepSeek AI – ເພີ່ມຄວາມຄິດສ້າງສັນ ແລະ ຜົນຜະລິດຂອງທ່ານໂດຍໃຊ້ DeepSeek R!, ເຄື່ອງມືທ່ອງເວັບທີ່ດີທີ່ສຸດທີ່ຂັບເຄື່ອນດ້ວຍປັນຍາປະດິດ."
    }
  }
};

// Function to update language files
const updateLanguageFiles = (language, translations) => {
  const languagePath = path.join(__dirname, 'languages', language);

  // Create language folder if it doesn't exist
  if (!fs.existsSync(languagePath)) {
    fs.mkdirSync(languagePath);
  }

  // Update messages.json file in the language folder
  const messagesFilePath = path.join(languagePath, 'messages.json');
  if (fs.existsSync(messagesFilePath)) {
    const existingTranslations = require(messagesFilePath);
    const updatedTranslations = { ...existingTranslations, ...translations };
    fs.writeFileSync(messagesFilePath, JSON.stringify(updatedTranslations, null, 2));
  } else {
    fs.writeFileSync(messagesFilePath, JSON.stringify(translations, null, 2));
  }
};

// Update all language files
Object.entries(translations).forEach(([language, languageTranslations]) => {
  updateLanguageFiles(language, languageTranslations);
}); 